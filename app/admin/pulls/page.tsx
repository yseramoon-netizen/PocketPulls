"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";

import PullMachine from "@/components/PullMachine";
import CardReveal from "@/components/CardReveal";
import PullStats from "@/components/PullStats";
import PullHistory from "@/components/PullHistory";



const DAILY_LIMIT = 10;





export default function PullsPage(){



const [user,setUser]=useState<any>(null);

const [loading,setLoading]=useState(true);

const [opening,setOpening]=useState(false);

const [progress,setProgress]=useState(0);

const [stage,setStage]=useState("");

const [card,setCard]=useState<any>(null);

const [history,setHistory]=useState<any[]>([]);

const [balance,setBalance]=useState(0);

const [dailyPulls,setDailyPulls]=useState(0);

const [error,setError]=useState("");





const pullPrice = dailyPulls + 1;







useEffect(()=>{

initialise();

},[]);









async function initialise(){


const {

data:{
user

}

}=await supabase.auth.getUser();




if(!user){

setLoading(false);

return;

}



setUser(user);




await Promise.all([

loadWallet(user),

loadDaily(user),

loadHistory(user)

]);



setLoading(false);


}









async function loadWallet(current:any){


const {

data

}=await supabase

.from("profiles")

.select("balance")

.eq(

"id",

current.id

)

.single();




setBalance(

Number(data?.balance || 0)

);


}









async function loadDaily(current:any){


const start=new Date();


start.setHours(

0,

0,

0,

0

);





const {

count

}=await supabase

.from("pull_history")

.select(

"id",

{

count:"exact",

head:true

}

)

.eq(

"user_id",

current.id

)

.gte(

"created_at",

start.toISOString()

);





setDailyPulls(

count || 0

);


}









async function loadHistory(current:any){


const {

data

}=await supabase

.from("pull_history")

.select(`

id,

created_at,

market_value,

amount_paid,


pokemon_cards(

name,

rarity,

image_url

)

`)

.eq(

"user_id",

current.id

)

.order(

"created_at",

{

ascending:false

}

)

.limit(10);







setHistory(

(data || []).map((item:any)=>(

{


id:item.id,


name:item.pokemon_cards?.name || "Unknown",


rarity:item.pokemon_cards?.rarity || "Unknown",


image_url:item.pokemon_cards?.image_url,


value:Number(item.market_value || 0),


amount_paid:Number(item.amount_paid || 0),


created_at:item.created_at


}

))

);


}









async function openPull(){



if(!user){

setError(
"Login required"
);

return;

}



if(opening)

return;





if(dailyPulls >= DAILY_LIMIT){

setError(
"The forest needs to recover 🌙"
);

return;

}




if(balance < pullPrice){

setError(
`You need £${pullPrice} balance`
);

return;

}






setError("");

setCard(null);

setOpening(true);

setProgress(0);



setStage(
"🌱 Awakening the ancient grove..."
);






let value=0;




const timer=setInterval(()=>{


value += 5;


setProgress(value);



if(value>30)

setStage(
"🍃 The leaves whisper..."
);



if(value>60)

setStage(
"✨ Ancient energy gathers..."
);



if(value>85)

setStage(
"🎴 Something is waiting..."
);



if(value>=100)

clearInterval(timer);



},150);







try{


const response=await fetch(

"/api/pull",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

userId:user.id

})

}

);





const data=await response.json();





if(!response.ok){

throw new Error(data.error);

}







setTimeout(async()=>{


setCard(data.card);



await loadWallet(user);

await loadDaily(user);

await loadHistory(user);



setOpening(false);



},3500);





}

catch(err:any){


setError(err.message);

setOpening(false);


}



}







if(loading){


return (

<div

className="

min-h-screen

flex

items-center

justify-center


bg-gradient-to-br

from-[#020617]

via-[#052e16]

to-[#064e3b]


text-emerald-100

font-black

text-xl

"

>

🌱 Awakening PocketPulls...

</div>

);


}

return (

<main

className="

relative

min-h-screen

overflow-hidden


bg-gradient-to-br

from-[#020617]

via-[#052e16]

to-[#064e3b]


p-4

pb-28

md:p-8


text-white

"

>


<ForestBackground />





<div

className="

relative

z-10

max-w-7xl

mx-auto

"

>


<AdminNav />









{/* MAIN SHRINE */}


<section

className="

mt-8

relative

overflow-hidden


rounded-[4rem]


bg-white/10


backdrop-blur-3xl


border

border-white/20


shadow-[0_30px_120px_rgba(16,185,129,0.35)]


p-10

md:p-14


text-center

"

>



<div

className="

absolute

inset-0


bg-gradient-to-br

from-white/20

via-transparent

to-emerald-400/20

"

/>






<div className="relative z-10">





<div

className="

mx-auto

w-40

h-40


rounded-full


bg-emerald-400/20


border

border-white/20


flex

items-center

justify-center


shadow-[0_0_100px_rgba(52,211,153,0.55)]

"

>


<img

src="/shaymin.png"

className="

w-32

drop-shadow-2xl

"

/>


</div>







<h1

className="

mt-8

text-5xl

md:text-6xl


font-black


bg-gradient-to-r

from-white

via-emerald-200

to-emerald-400


bg-clip-text

text-transparent

"

>

Ancient Pull Shrine

</h1>





<p

className="

mt-4

text-xl

text-emerald-100

font-semibold

"

>

Discover Pokémon hidden within the forest

</p>








{/* CRYSTAL STATS */}



<div

className="

mt-12

grid

grid-cols-1

md:grid-cols-3


gap-6

"

>





<div

className="

rounded-[2rem]


bg-white/10


border

border-white/20


backdrop-blur-xl


p-6


shadow-[0_0_40px_rgba(52,211,153,0.25)]

"

>

<p className="text-4xl">

💎

</p>

<p className="text-sm uppercase text-emerald-200 font-bold">

Wallet Crystal

</p>

<p className="text-3xl font-black">

£{balance.toFixed(2)}

</p>

</div>








<div

className="

rounded-[2rem]


bg-white/10


border

border-white/20


backdrop-blur-xl


p-6

"

>

<p className="text-4xl">

🌙

</p>

<p className="text-sm uppercase text-emerald-200 font-bold">

Daily Energy

</p>

<p className="text-3xl font-black">

{dailyPulls}/{DAILY_LIMIT}

</p>

</div>








<div

className="

rounded-[2rem]


bg-white/10


border

border-white/20


backdrop-blur-xl


p-6

"

>

<p className="text-4xl">

🎴

</p>

<p className="text-sm uppercase text-emerald-200 font-bold">

Discovery Cost

</p>

<p className="text-3xl font-black">

£{pullPrice}

</p>

</div>



</div>









{/* OPEN BUTTON */}



<button


onClick={openPull}


disabled={opening}


className="


mt-12


px-16

py-6


rounded-full


bg-emerald-400/30


border

border-emerald-200/40


backdrop-blur-xl


font-black


text-xl


shadow-[0_0_70px_rgba(52,211,153,0.6)]


hover:bg-emerald-400/50


hover:scale-105


transition-all


disabled:opacity-50

"

>


{

opening

?

"🌱 The forest is awakening..."

:

"🎴 Open Hidden Discovery"

}


</button>





</div>


</section>









{/* MACHINE */}


{

opening &&

<section

className="

mt-10


rounded-[3rem]


bg-white/10


backdrop-blur-3xl


border

border-white/20


p-8


shadow-[0_30px_100px_rgba(16,185,129,0.35)]

"

>


<PullMachine

opening={opening}

stage={stage}

progress={progress}

/>


</section>


}









{/* REVEAL */}



{

card && !opening &&


<section

className="

mt-10


rounded-[3rem]


bg-white/10


backdrop-blur-3xl


border

border-white/20


p-8


shadow-[0_30px_120px_rgba(250,204,21,0.25)]

"

>


<CardReveal card={card}/>


</section>


}









{/* STATS */}


<section

className="

mt-10


rounded-[3rem]


bg-white/10


backdrop-blur-3xl


border

border-white/20


p-8

"

>


<PullStats


cost={history.reduce(

(a,b)=>a+b.amount_paid,

0

)}


totalValue={history.reduce(

(a,b)=>a+b.value,

0

)}


bestPull={{

name:history[0]?.name || "None",

value:history[0]?.value || 0

}}


count={history.length}


/>


</section>









{/* HISTORY */}


<section

className="

mt-10


rounded-[3rem]


bg-black/30


backdrop-blur-3xl


border

border-emerald-400/20


p-8


"

>


<h2

className="

text-3xl

font-black

mb-6

"

>

🌿 Forest Discovery Records

</h2>




<PullHistory items={history}/>


</section>









{

error &&


<div

className="

mt-8


rounded-3xl


bg-red-500/20


border

border-red-300/30


backdrop-blur-xl


p-5


text-center


font-bold


"

>

{error}

</div>


}



</div>


</main>

);

}
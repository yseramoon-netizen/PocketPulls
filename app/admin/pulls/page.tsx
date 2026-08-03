"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";

import PullMachine from "@/components/PullMachine";
import CardReveal from "@/components/CardReveal";
import PullStats from "@/components/PullStats";
import PullHistory from "@/components/PullHistory";


const DAILY_LIMIT = 100;



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


await refreshData(user);


setLoading(false);


}







async function refreshData(current:any){


await Promise.all([

loadWallet(current),

loadDaily(current),

loadHistory(current)

]);


}








async function loadWallet(current:any){


const {
data,
error
}=await supabase

.from("profiles")

.select("balance")

.eq(
"id",
current.id
)

.single();


if(error){

console.log(error);

return;

}


setBalance(
Number(data?.balance || 0)
);


}










async function loadDaily(current:any){


const start=new Date();

start.setHours(0,0,0,0);



const {
count,
error
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



if(error){

console.log(error);

return;

}


setDailyPulls(count || 0);


}









async function loadHistory(current:any){


const {
data,
error
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



if(error){

console.log(error);

return;

}




setHistory(

(data || []).map((item:any)=>{


const pulledCard = Array.isArray(item.pokemon_cards)

?

item.pokemon_cards[0]

:

item.pokemon_cards;



return {

id:item.id,

name:pulledCard?.name || "Unknown",

rarity:pulledCard?.rarity || "Unknown",

image_url:pulledCard?.image_url,

value:Number(item.market_value || 0),

amount_paid:Number(item.amount_paid || 0),

created_at:item.created_at

};


})

);


}










async function openPull(){


if(!user){

setError("Login required");

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
"🌱 Awakening the grove..."
);




let value=0;



const timer=setInterval(()=>{


value+=5;


setProgress(value);



if(value>30)

setStage(
"🍃 Leaves begin to move..."
);



if(value>60)

setStage(
"✨ Ancient energy gathers..."
);



if(value>85)

setStage(
"🎴 A discovery appears..."
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



await new Promise(

resolve=>setTimeout(resolve,1000)

);



await refreshData(user);



setOpening(false);



},3500);



}

catch(err:any){


console.error(err);


setError(err.message);


setOpening(false);


}



}









if(loading){

return(

<div className="
min-h-screen
flex
items-center
justify-center
bg-[#020617]
text-emerald-100
font-black
text-xl
">

🌱 Awakening PocketPulls...

</div>

);

}






return (

<main className="

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

">


<ForestBackground />



<div className="
relative
z-10
max-w-7xl
mx-auto
">


<AdminNav />



<section className="

mt-8

rounded-[4rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

shadow-[0_30px_100px_rgba(16,185,129,.25)]

p-10

text-center

">


<img

src="/shaymin.png"

className="
w-32
mx-auto
drop-shadow-2xl
"

/>



<h1 className="

mt-5

text-5xl

font-black

">

PocketPulls Grove

</h1>



<p className="

mt-3

text-emerald-100

text-xl

">

Discover Pokémon hidden inside the forest 🌿

</p>



<div className="

mt-10

grid

md:grid-cols-3

gap-5

">


<div className="bg-white/10 border border-white/20 rounded-3xl p-6">

💎

<p className="font-bold">
Wallet
</p>

<p className="text-3xl font-black">

£{balance.toFixed(2)}

</p>

</div>



<div className="bg-white/10 border border-white/20 rounded-3xl p-6">

🌙

<p className="font-bold">
Daily Pulls
</p>

<p className="text-3xl font-black">

{dailyPulls}/{DAILY_LIMIT}

</p>

</div>



<div className="bg-white/10 border border-white/20 rounded-3xl p-6">

🎴

<p className="font-bold">
Pull Cost
</p>

<p className="text-3xl font-black">

£{pullPrice}

</p>

</div>


</div>





<button

onClick={openPull}

disabled={opening}

className="

mt-10

px-16

py-6

rounded-full

bg-emerald-400/30

border

border-emerald-200/40

shadow-[0_0_50px_rgba(52,211,153,.5)]

font-black

text-xl

"

>

{

opening

?

"🌱 Growing Discovery..."

:

"🎴 Open Discovery"

}

</button>


</section>







{

opening &&

<div className="mt-10">

<PullMachine

opening={opening}

stage={stage}

progress={progress}

/>

</div>

}








{

card && !opening &&

<div className="mt-10">

<CardReveal card={card}/>

</div>

}







<section className="

mt-10

rounded-[3rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

p-8

">


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






<section className="

mt-10

rounded-[3rem]

bg-black/30

border

border-emerald-500/20

p-8

">


<h2 className="

text-3xl

font-black

mb-6

">

🌿 Discovery Log

</h2>



<PullHistory items={history}/>



</section>





{

error &&

<div className="

mt-8

rounded-3xl

bg-red-500/20

border

border-red-400/30

p-5

text-center

font-bold

">

{error}

</div>

}



</div>


</main>

);


}
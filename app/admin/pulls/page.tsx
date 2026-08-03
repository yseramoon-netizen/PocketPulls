"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import PullMachine from "@/components/PullMachine";
import CardReveal from "@/components/CardReveal";
import PullStats from "@/components/PullStats";
import PullHistory from "@/components/PullHistory";


export default function PullsPage(){


const [user,setUser] = useState<any>(null);

const [checking,setChecking] = useState(true);

const [opening,setOpening] = useState(false);

const [progress,setProgress] = useState(0);

const [stage,setStage] = useState("");

const [card,setCard] = useState<any>(null);

const [history,setHistory] = useState<any[]>([]);

const [error,setError] = useState("");





useEffect(()=>{

loadUser();

},[]);






async function loadUser(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

setChecking(false);

return;

}



setUser(user);

await loadHistory();

setChecking(false);


}







async function loadHistory(){


const {
data,
error
}=await supabase

.from("pull_history")

.select(`

id,

created_at,

market_value,

pokemon_cards(

name,

image_url,

rarity

)

`)

.order(

"created_at",

{
ascending:false
}

)

.limit(20);




if(error){

setError(error.message);

return;

}



const formatted = (data || []).map((item:any)=>({

id:item.id,

name:item.pokemon_cards?.name || "Unknown",

rarity:item.pokemon_cards?.rarity || "Unknown",

value:Number(item.market_value || 0),

created_at:item.created_at,

image_url:item.pokemon_cards?.image_url

}));


setHistory(formatted);


}









async function openPull(){


if(!user){

setError("Login required");

return;

}



setError("");

setCard(null);

setOpening(true);

setProgress(0);



setStage(
"🌱 The forest awakens..."
);




let current=0;


const interval=setInterval(()=>{


current+=5;


setProgress(current);



if(current>=25){

setStage(
"✨ Ancient roots are glowing..."
);

}



if(current>=60){

setStage(
"🌸 Something is blooming..."
);

}



if(current>=90){

setStage(
"🎴 A hidden treasure emerges..."
);

}



if(current>=100){

clearInterval(interval);

}


},200);








setTimeout(async()=>{


try{


const response = await fetch(

"/api/pull",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:JSON.stringify({

userId:user.id

})

}

);




const data = await response.json();





if(!response.ok){

throw new Error(
data.error || "Pull failed"
);

}




setCard(data.card);

await loadHistory();



}

catch(err:any){

setError(err.message);

}



setOpening(false);


},4500);



}









const totalValue =
history.reduce(

(sum,item)=>sum+Number(item.value || 0),

0

);



const bestPull =
history.length

?

history.reduce(

(best,item)=>

item.value > best.value

?

item

:

best

)

:

{
name:"No pull yet",
value:0
};









if(checking){

return(

<div className="
min-h-screen
bg-black
flex
items-center
justify-center
text-emerald-400
font-black
text-xl
">

🌲 Entering PocketPulls Forest...

</div>

);

}









return(

<main

className="
min-h-screen

bg-gradient-to-br

from-[#020617]

via-[#052e16]

to-[#064e3b]

p-4

md:p-8

pb-40

text-white

"

>


<div

className="
max-w-6xl
mx-auto
"

>


<AdminNav />







<section

className="
mt-10

rounded-[3rem]

bg-white/10

backdrop-blur-2xl

border

border-white/20

p-10

text-center

shadow-2xl

"

>


<img

src="/shaymin.png"

className="
w-32
mx-auto
drop-shadow-xl
"

/>





<h1 className="
mt-6

text-6xl

font-black

bg-gradient-to-r

from-yellow-300

via-emerald-300

to-green-400

bg-clip-text

text-transparent

">

PocketPulls

</h1>





<p className="
mt-4

text-emerald-100

font-bold

">

Discover Pokémon hidden inside the forest

</p>







<button

onClick={openPull}

disabled={opening}

className="
mt-10

px-14

py-6

rounded-full

bg-gradient-to-r

from-yellow-300

to-orange-400

text-black

font-black

text-xl

shadow-xl

hover:scale-110

transition

"

>

{

opening

?

"🌿 Growing..."

:

"🎴 Open Pull"

}

</button>


</section>









{opening && (

<div className="
mt-12
flex
justify-center
">

<PullMachine

opening={opening}

progress={progress}

stage={stage}

/>

</div>

)}









{card && !opening && (

<div className="
mt-12
flex
justify-center
">

<CardReveal

card={card}

/>

</div>

)}









<PullStats

cost={history.length * 5}

totalValue={totalValue}

bestPull={{

name:bestPull.name,

value:bestPull.value

}}

count={history.length}

/>









<PullHistory

items={history}

/>









{error && (

<div className="
mt-10

bg-red-500/20

border

border-red-400

rounded-3xl

p-5

text-center

font-bold

">

{error}

</div>

)}



</div>

</main>

);

}
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import PullMachine from "@/components/PullMachine";
import PullCard from "@/components/PullCard";
import PullStats from "@/components/PullStats";
import PullHistory from "@/components/PullHistory";



export default function PullsPage(){


const [user,setUser]=useState<any>(null);

const [checking,setChecking]=useState(true);

const [opening,setOpening]=useState(false);

const [progress,setProgress]=useState(0);

const [card,setCard]=useState<any>(null);

const [history,setHistory]=useState<any[]>([]);

const [stage,setStage]=useState("");

const [error,setError]=useState("");







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

created_at,

market_value,

pokemon_cards!inner(

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

.limit(5);





if(error){

console.log(error);

return;

}



setHistory(data || []);



}









async function openPull(){


if(!user){

setError("Please login first");

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



const energy=setInterval(()=>{


current += 5;


setProgress(current);



if(current >= 30){

setStage(
"✨ Ancient roots are glowing..."
);

}



if(current >= 60){

setStage(
"🌟 A hidden Pokémon is emerging..."
);

}



if(current >=100){

clearInterval(energy);

}


},150);








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





const data =
await response.json();





if(!response.ok){

throw new Error(
data.error || "Pull failed"
);

}



setProgress(100);



setStage(
"🎴 Discovery complete!"
);




setTimeout(()=>{


setCard(data.card);


},700);




await loadHistory();





}

catch(err:any){


console.log(err);

setError(err.message);


}



setOpening(false);



},4500);



}









if(checking){

return(

<div

className="
min-h-screen
bg-black
flex
items-center
justify-center

text-emerald-400

font-black

text-xl

"

>

🌲 Entering PocketPulls Forest...

</div>

)

}









return(

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

md:p-8

pb-40

text-white

"

>



<div

className="
max-w-6xl

mx-auto

relative

z-10

"

>



<AdminNav />









<section

className="

mt-10

rounded-[3rem]

bg-white/5

border

border-white/10

backdrop-blur-2xl

shadow-[0_0_100px_rgba(16,185,129,.25)]

p-10

text-center

"

>



<img

src="/shaymin.png"

className="

w-32

mx-auto

drop-shadow-2xl

"

/>





<h1

className="

mt-6

text-6xl

font-black

bg-gradient-to-r

from-yellow-300

via-emerald-300

to-green-400

bg-clip-text

text-transparent

"

>

PocketPulls

</h1>






<p

className="

mt-4

text-emerald-100

font-bold

text-lg

"

>

Discover Pokémon hidden inside the forest

</p>








<button

onClick={openPull}

disabled={opening}

className="

mt-10

px-16

py-6

rounded-full

bg-gradient-to-r

from-yellow-300

to-orange-400

text-black

font-black

text-xl

shadow-[0_0_60px_rgba(250,204,21,.6)]

hover:scale-110

transition

disabled:opacity-50

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

<div className="mt-14">

<PullMachine

opening={opening}

stage={stage}

progress={progress}

/>

</div>

)}









{card && !opening && (

<div

className="

mt-16

flex

justify-center

"

>

<PullCard

card={card}

/>

</div>

)}









<section className="mt-16">

<PullStats

history={history}

/>

</section>









<section className="mt-16">

<PullHistory

history={history}

/>

</section>









{error && (

<div

className="

mt-10

rounded-3xl

bg-red-500/20

border

border-red-400

p-5

text-center

font-bold

"

>

{error}

</div>

)}





</div>



</main>


);


}
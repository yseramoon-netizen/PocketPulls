"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import PullAnimation from "@/components/PullAnimation";
import PullCard from "@/components/PullCard";
import PullStats from "@/components/PullStats";
import PullHistory from "@/components/PullHistory";


export default function PullsPage(){


const [user,setUser]=useState<any>(null);

const [checking,setChecking]=useState(true);

const [opening,setOpening]=useState(false);

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

setError(error.message);

return;

}



setHistory(data || []);



}









async function openPull(){


if(!user){

setError(
"Please login before pulling"
);

return;

}



setError("");

setCard(null);

setOpening(true);





setStage(
"🌱 The forest awakens..."
);




setTimeout(()=>{

setStage(
"✨ Ancient roots are glowing..."
);

},1200);




setTimeout(()=>{

setStage(
"🌟 A hidden Pokémon is emerging..."
);

},2600);





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





setCard(data.card);



await loadHistory();



}

catch(err:any){


setError(err.message);


}



setOpening(false);



},4200);



}








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

)

}









return(

<main

className="
min-h-screen

relative

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









{/* HERO */}

<section

className="
mt-10

relative

overflow-hidden

rounded-[3rem]

border

border-white/10

bg-white/5

backdrop-blur-2xl

shadow-[0_0_100px_rgba(16,185,129,.25)]

p-10

text-center

"

>


<div

className="
absolute
inset-0

bg-gradient-to-br

from-emerald-400/10

via-transparent

to-yellow-300/10

"

/>





<div className="relative">


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

Discover Pokémon hidden within the forest

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

shadow-[0_0_60px_rgba(250,204,21,.7)]

hover:scale-110

transition

disabled:opacity-50

"

>

{

opening

?

"🌿 Searching..."

:

"🎴 Open Pull"

}


</button>



</div>


</section>









{/* REVEAL AREA */}

{

opening && (

<div

className="
mt-16

flex

justify-center

"

>


<PullAnimation

stage={stage}

/>


</div>

)

}









{/* CARD REVEAL */}

{

card && !opening && (

<div

className="
mt-16

flex

justify-center

items-center

w-full

"

>


<PullCard

card={card}

/>


</div>

)

}









{/* PROFILE */}

<section

className="
mt-16
"

>


<PullStats

history={history}

/>


</section>









{/* HISTORY */}

<section

className="
mt-16
"

>


<PullHistory

history={history}

/>


</section>









{

error && (

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

)

}





</div>



</main>

);


}
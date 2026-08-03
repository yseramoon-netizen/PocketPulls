"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";

import ForestBackground from "@/components/ForestBackground";
import ForestStats from "@/components/ForestStats";
import ForestGrowth from "@/components/ForestGrowth";
import DiscoveryLog from "@/components/DiscoveryLog";


export default function AdminPage(){


const [stats,setStats]=useState({

cards:0,
value:0,
locations:0

});


const [contributors,setContributors]=useState({

Lukas:0,
Skye:0

});


const [recent,setRecent]=useState<any[]>([]);


const [userName,setUserName]=useState("Trainer");


const [loading,setLoading]=useState(true);





useEffect(()=>{

loadDashboard();

},[]);







async function loadDashboard(){


setLoading(true);




// USER

const {

data:{
user

}

}=await supabase.auth.getUser();




if(user){


const {

data:profile

}=await supabase

.from("profiles")

.select("name")

.eq(
"id",
user.id
)

.maybeSingle();



setUserName(

profile?.name || "Trainer"

);


}






// INVENTORY

const {

data:inventory

}=await supabase

.from("inventory")

.select(`

quantity,

location,

pokemon_cards(

market_value

)

`);





let cards=0;

let value=0;

let locations=new Set();





inventory?.forEach((item:any)=>{


const card=

Array.isArray(item.pokemon_cards)

?

item.pokemon_cards[0]

:

item.pokemon_cards;



const quantity=

Number(item.quantity || 0);




cards += quantity;



value +=

quantity *

Number(card?.market_value || 0);





if(item.location)

locations.add(item.location);



});





setStats({

cards,

value,

locations:locations.size

});









// CONTRIBUTORS

const {

data:people

}=await supabase

.from("inventory")

.select(`

quantity,

profiles:added_by_user_id(

name

)

`);





let Lukas=0;

let Skye=0;





people?.forEach((item:any)=>{


const amount=

Number(item.quantity || 0);





if(item.profiles?.name==="Lukas")

Lukas+=amount;





if(item.profiles?.name==="Skye")

Skye+=amount;



});





setContributors({

Lukas,

Skye

});









// RECENT DISCOVERIES

const {

data:latest

}=await supabase

.from("inventory")

.select(`

id,

quantity,

location,

created_at,


profiles:added_by_user_id(

name

),


pokemon_cards(

name,

image_url

)

`)

.order(

"created_at",

{

ascending:false

}

)

.limit(8);





setRecent(latest || []);




setLoading(false);


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

md:pb-8


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








{/* SHAYMIN SANCTUARY */}


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


text-center

"

>


{/* glass reflection */}

<div

className="

absolute

inset-0


bg-gradient-to-br

from-white/20

via-transparent

to-emerald-400/20


pointer-events-none

"

/>





<div className="absolute top-8 left-10 text-5xl opacity-30">

🍃

</div>




<div className="absolute bottom-8 right-10 text-5xl opacity-30">

🦋

</div>








<div

className="

relative

z-10

"

>





<div

className="

mx-auto

w-48

h-48


rounded-full


bg-gradient-to-br

from-emerald-300/30

to-emerald-950/40


backdrop-blur-2xl


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

w-36

h-36


drop-shadow-[0_0_35px_rgba(52,211,153,0.8)]

"

/>


</div>






<h1

className="

mt-10


text-5xl

md:text-6xl


font-black


tracking-tight


bg-gradient-to-r

from-white

via-emerald-100

to-emerald-300


bg-clip-text


text-transparent

"

>

PocketPulls Forest

</h1>






<p

className="

mt-4

text-xl

font-semibold

text-emerald-100

"

>

Welcome back {userName} 🌿

</p>





<p

className="

mt-2

text-sm

text-emerald-200/70

"

>

Your sanctuary grows with every discovery

</p>




</div>




</section>









{


loading

?


<div

className="

mt-20

text-center

text-emerald-100

font-bold

text-xl

"

>

🌱 Awakening the forest...

</div>



:


<>



<ForestStats

cards={stats.cards}

value={stats.value}

locations={stats.locations}

/>





<ForestGrowth

Lukas={contributors.Lukas}

Skye={contributors.Skye}

/>





<DiscoveryLog

recent={recent}

/>




</>


}




</div>


</main>


);


}
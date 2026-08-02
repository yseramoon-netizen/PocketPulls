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









// RECENT


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





setRecent(

latest || []

);



setLoading(false);


}













return (

<main

className="

relative

min-h-screen

overflow-hidden

bg-gradient-to-br

from-[#dff7e8]

via-[#fff7d6]

to-[#f8e7ff]

p-4
pb-28
md:p-8
md:pb-8
text-gray-900

"

>


<ForestBackground/>




<div

className="

relative

z-10

max-w-7xl

mx-auto

"

>



<AdminNav/>









<section

className="

mt-8

relative

overflow-hidden

rounded-[4rem]

bg-white/60

backdrop-blur-xl

border

border-white

shadow-2xl

p-10

text-center

"

>



<div className="absolute top-6 left-8 text-4xl opacity-40">

🍃

</div>



<div className="absolute bottom-6 right-8 text-4xl opacity-40">

🦋

</div>






<img

src="/shaymin.png"

className="

w-36

h-36

mx-auto

drop-shadow-2xl

"

/>






<h1

className="

mt-5

text-5xl

md:text-6xl

font-black

text-emerald-950

"

>

PocketPulls Forest

</h1>







<p

className="

mt-4

text-xl

font-semibold

text-emerald-700

"

>

Welcome back {userName} 🌿

</p>











</section>









{

loading ?



<div

className="

mt-20

text-center

text-emerald-900

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
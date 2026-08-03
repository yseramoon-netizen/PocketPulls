"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

export default function AddPage() {


const [search,setSearch]=useState("");
const [cards,setCards]=useState<any[]>([]);
const [selectedCard,setSelectedCard]=useState<any>(null);

const [quantity,setQuantity]=useState(1);
const [location,setLocation]=useState("");

const [user,setUser]=useState<any>(null);

const [message,setMessage]=useState("");



useEffect(()=>{

loadUser();

},[]);





async function loadUser(){

const {
data:{user}
}=await supabase.auth.getUser();

setUser(user);

}







async function searchCards(value:string){


setSearch(value);


if(!value.trim()){

setCards([]);

return;

}



const {
data,
error

}=await supabase

.from("pokemon_cards")

.select("*")

.ilike(
"name",
`%${value}%`
)

.limit(20);



if(error){

console.log(error);

return;

}


setCards(data || []);

}









async function addToInventory(){


if(!selectedCard)

return alert(
"Choose a Pokémon first 🌿"
);



if(!user)

return alert(
"Login required"
);




const {
data:existing

}=await supabase

.from("inventory")

.select("id,quantity")

.eq(
"card_id",
selectedCard.id
)

.maybeSingle();







if(existing){


await supabase

.from("inventory")

.update({

quantity:

Number(existing.quantity)

+

Number(quantity)

})

.eq(
"id",
existing.id
);



}

else {


await supabase

.from("inventory")

.insert({

card_id:selectedCard.id,

quantity,

status:"in_stock",

location:
location || "Forest Storage",

added_by:user.email,

added_by_user_id:user.id

});


}






setMessage(

`${selectedCard.name} joined the forest 🌿`

);


setSelectedCard(null);

setQuantity(1);

setLocation("");

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



<div className="relative z-10 max-w-7xl mx-auto">


<AdminNav />







{/* Shrine Header */}


<section

className="

rounded-[3rem]

relative

overflow-hidden


bg-white/10

backdrop-blur-3xl

border

border-white/20


shadow-[0_30px_100px_rgba(16,185,129,0.3)]


p-8

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

w-36

h-36

rounded-full


bg-emerald-400/20


border

border-white/20


flex

items-center

justify-center


shadow-[0_0_80px_rgba(52,211,153,0.5)]

"

>


<img

src="/shaymin.png"

className="w-28 drop-shadow-2xl"

/>


</div>






<h1

className="

mt-6

text-5xl

font-black

bg-gradient-to-r

from-white

to-emerald-300

bg-clip-text

text-transparent

"

>

Card Logger

</h1>




<p className="mt-3 text-emerald-100">

Register new Pokémon into the Pulls forest 🌿

</p>



</div>



</section>









{/* Search Crystal */}



<div

className="

mt-10

"

>


<input


className="

w-full

p-5

rounded-full


bg-white/10


backdrop-blur-3xl


border

border-white/20


text-white


placeholder:text-emerald-200/60


shadow-[0_20px_60px_rgba(16,185,129,0.25)]


outline-none


focus:ring-2

focus:ring-emerald-400

"

placeholder="🔍 Search Pokémon card..."

value={search}

onChange={(e)=>
searchCards(e.target.value)
}

/>


</div>









{/* Card Gallery */}



<div

className="

grid

grid-cols-2

sm:grid-cols-3

md:grid-cols-5


gap-6

mt-8

"

>



{

cards.map(card=>(


<div

key={card.id}

onClick={()=>setSelectedCard(card)}

className="

cursor-pointer


rounded-[2rem]


bg-white/10


border

border-white/20


backdrop-blur-2xl


p-3


hover:-translate-y-3


hover:bg-white/20


transition-all


shadow-[0_20px_50px_rgba(16,185,129,0.2)]

"

>


<div

className="

rounded-2xl

overflow-hidden

bg-black/20

"

>


<img

src={card.image_url}

className="w-full"

/>


</div>



<p className="mt-3 font-black">

{card.name}

</p>


<p className="text-xs text-emerald-200/70">

{card.set_name}

</p>


</div>


))

}


</div>









{/* Capture Chamber */}



{

selectedCard && (


<div

className="

fixed

bottom-6

left-1/2

-translate-x-1/2


w-[90%]


max-w-lg


z-50


rounded-[3rem]


bg-gradient-to-br

from-white/20

to-emerald-950/80


backdrop-blur-3xl


border

border-white/20


shadow-[0_30px_120px_rgba(16,185,129,0.5)]


p-7

"

>



<h2 className="text-3xl font-black">

{selectedCard.name}

</h2>






<div

className="

flex

justify-center

gap-6

items-center

my-6

"


>


<button

className="w-14 h-14 rounded-full bg-red-400/30 border border-white/20 text-2xl"

onClick={()=>setQuantity(Math.max(1,quantity-1))}

>

−

</button>



<span className="text-4xl font-black">

{quantity}

</span>



<button

className="w-14 h-14 rounded-full bg-emerald-400/30 border border-white/20 text-2xl"

onClick={()=>setQuantity(quantity+1)}

>

+

</button>


</div>







<input

className="

w-full

p-4

rounded-xl


bg-white/10


border

border-white/20


placeholder:text-emerald-200/60

"

placeholder="Forest storage location"

value={location}

onChange={(e)=>setLocation(e.target.value)}

 />








<button

onClick={addToInventory}

className="

mt-5

w-full

py-4

rounded-xl


font-black


bg-emerald-400/40


border

border-emerald-200/40


shadow-[0_0_40px_rgba(52,211,153,0.5)]


hover:bg-emerald-400/60


transition

"

>

🌿 Plant Pokémon

</button>



</div>


)


}







{

message && (

<div

className="

fixed

top-24

left-1/2

-translate-x-1/2


bg-emerald-400/80


backdrop-blur-xl


px-6

py-3


rounded-full


font-bold


shadow-[0_0_50px_rgba(52,211,153,0.8)]

"

>

✨ {message}

</div>

)

}





</div>


</main>

);


}
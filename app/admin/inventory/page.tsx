"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";

import ForestBackground from "@/components/ForestBackground";



export default function InventoryPage(){


const [inventory,setInventory]=useState<any[]>([]);

const [search,setSearch]=useState("");

const [loading,setLoading]=useState(true);

const [refreshing,setRefreshing]=useState(false);





useEffect(()=>{

loadInventory();

},[]);








async function loadInventory(){


const {

data,

error

}=await supabase

.from("inventory")

.select(`

id,

quantity,

location,

pokemon_cards(

id,

name,

image_url,

rarity,

set_name,

card_no,

market_value

)

`)

.order(

"created_at",

{

ascending:false

}

);





if(error){

console.error(error);

return;

}



setInventory(data || []);

setLoading(false);


}









async function updateQuantity(

id:string,

amount:number,

current:number

){



const newQuantity=current+amount;




if(newQuantity<=0){


await supabase

.from("inventory")

.delete()

.eq(

"id",

id

);


}

else{


await supabase

.from("inventory")

.update({

quantity:newQuantity

})

.eq(

"id",

id

);


}



loadInventory();


}









async function refreshMarket(){


setRefreshing(true);



try{


const response = await fetch(

"/api/update-prices",

{

method:"POST"

}

);



const result = await response.json();





if(!response.ok){


alert(

result.error || "Failed to update prices"

);


return;


}



await loadInventory();



alert(

"Market values updated!"

);



}

catch(error){


console.error(error);

alert(

"API request failed"

);


}

finally{


setRefreshing(false);


}


}









function rarityStyle(rarity:string){


const r = rarity?.toLowerCase() || "";





if(r.includes("secret"))

return {

border:
"border-indigo-400/50",

glow:
"shadow-[0_0_60px_rgba(99,102,241,0.45)]",

badge:
"bg-indigo-400/20 text-indigo-100"

};







if(r.includes("illustration"))

return {

border:
"border-pink-400/50",

glow:
"shadow-[0_0_60px_rgba(236,72,153,0.45)]",

badge:
"bg-pink-400/20 text-pink-100"

};








if(r.includes("ultra"))

return {

border:
"border-purple-400/50",

glow:
"shadow-[0_0_60px_rgba(168,85,247,0.45)]",

badge:
"bg-purple-400/20 text-purple-100"

};








if(r.includes("rare"))

return {

border:
"border-yellow-400/50",

glow:
"shadow-[0_0_60px_rgba(250,204,21,0.45)]",

badge:
"bg-yellow-400/20 text-yellow-100"

};







return {


border:
"border-emerald-400/30",


glow:
"shadow-[0_0_45px_rgba(52,211,153,0.25)]",


badge:
"bg-emerald-400/20 text-emerald-100"


};


}









const filtered = inventory.filter(item=>{


const card=item.pokemon_cards;


return card?.name

?.toLowerCase()

.includes(

search.toLowerCase()

);


});








const totalVisitors = inventory.reduce(

(total,item)=>

total+

Number(item.quantity || 0),

0

);







const totalTreasure = inventory.reduce(

(total,item)=>


total +

(

Number(item.quantity || 0)

*

Number(item.pokemon_cards?.market_value || 0)

),


0

);

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








{/* VAULT HEADER */}


<section

className="

mt-8

relative

overflow-hidden


rounded-[3rem]


bg-white/10


backdrop-blur-3xl


border

border-white/20


shadow-[0_30px_120px_rgba(16,185,129,0.35)]


p-10


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


<h1

className="

text-5xl

font-black


bg-gradient-to-r

from-white

via-emerald-100

to-emerald-300


bg-clip-text

text-transparent

"

>

🏛️ Bulk Inventory

</h1>




<p

className="

mt-4

text-xl

font-bold

text-emerald-100

"

>

{totalVisitors.toLocaleString()} Pokémon stored

</p>







<div

className="

mt-10

grid

md:grid-cols-2

gap-6

"

>


{/* Treasure */}

<div

className="

rounded-[2rem]

bg-yellow-400/10

border

border-yellow-300/30

backdrop-blur-xl

p-6

shadow-[0_0_50px_rgba(250,204,21,0.2)]

"

>


<p className="text-yellow-200 font-bold uppercase text-sm">

Forest Treasure

</p>


<p className="text-4xl font-black mt-2">

£{totalTreasure.toFixed(2)}

</p>


</div>








{/* Refresh */}

<button

onClick={refreshMarket}

disabled={refreshing}

className="

rounded-[2rem]

bg-emerald-400/20

border

border-emerald-300/30


font-black


text-lg


hover:bg-emerald-400/40


transition


shadow-[0_0_40px_rgba(52,211,153,0.35)]

"

>

{

refreshing

?

"🌱 Updating market..."

:

"💎 Refresh Market Values"

}


</button>



</div>


</div>



</section>









{/* SEARCH */}


<input


value={search}


onChange={(e)=>setSearch(e.target.value)}


placeholder="🔍 Search vault collection..."


className="

mt-10

w-full

rounded-[2rem]


p-5


bg-white/10


backdrop-blur-3xl


border

border-white/20


text-white


placeholder:text-emerald-200/60


outline-none


shadow-[0_20px_60px_rgba(16,185,129,0.25)]

"

/>









{

loading ?


<div

className="

text-center

mt-20

text-xl

font-bold

text-emerald-100

"

>

🌱 Opening vault...

</div>



:


<div

className="

grid

grid-cols-1

sm:grid-cols-2

lg:grid-cols-4

gap-8

mt-10

"

>


{


filtered.map((item:any)=>{


const card=item.pokemon_cards;


const rarity=rarityStyle(card?.rarity);




return (


<div


key={item.id}


className={`


rounded-[2.5rem]


overflow-hidden


bg-white/10


backdrop-blur-3xl


border


${rarity.border}


${rarity.glow}


transition-all


hover:-translate-y-3


duration-300


`}


>





{/* CARD IMAGE */}


<div

className="

p-4

"

>


<div

className="

rounded-[2rem]

overflow-hidden

bg-black/20

"

>


<img

src={card.image_url}

className="

w-full

aspect-[3/4]

object-cover

"

 />


</div>


</div>








<div

className="

px-6

pb-6

"

>


<h2

className="

text-2xl

font-black

"

>

{card.name}

</h2>





<p className="text-emerald-200/70">

{card.set_name}

#{card.card_no}

</p>








<div

className={`

inline-block

mt-4

px-4

py-2

rounded-full

font-black

${rarity.badge}

`}

>

{card.rarity}

</div>









<div

className="

mt-5

rounded-3xl

bg-black/20

border

border-white/10

p-5

space-y-3

"

>


<p>

📦 Quantity:

<b>

{" "}

{item.quantity}

</b>

</p>




<p>

💎 Value:

<b>

£{Number(card.market_value || 0).toFixed(2)}

</b>

</p>




<p>

🏆 Total:

<b>

£{(

Number(item.quantity)

*

Number(card.market_value || 0)

).toFixed(2)}

</b>

</p>



</div>









<div

className="

grid

grid-cols-2

gap-3

mt-5

"

>


<button

onClick={()=>updateQuantity(

item.id,

-1,

item.quantity

)}

className="

rounded-2xl

bg-red-400/20

border

border-red-300/30

py-3

font-black

hover:bg-red-400/40

"

>

−

</button>






<button

onClick={()=>updateQuantity(

item.id,

1,

item.quantity

)}

className="

rounded-2xl

bg-emerald-400/20

border

border-emerald-300/30

py-3

font-black

hover:bg-emerald-400/40

"

>

+

</button>



</div>







<button

onClick={()=>updateQuantity(

item.id,

-item.quantity,

item.quantity

)}

className="

mt-3

w-full

rounded-2xl

bg-black/40

border

border-white/10

py-3

font-bold

hover:bg-black/60

"

>

Remove From Vault

</button>





</div>



</div>


)


})


}



</div>



}



</div>


</main>

);

}
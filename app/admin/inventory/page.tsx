"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";


export default function InventoryPage(){

const [inventory,setInventory]=useState<any[]>([]);
const [search,setSearch]=useState("");
const [loading,setLoading]=useState(true);
const [refreshing,setRefreshing]=useState(false);



const fireflies = useMemo(
()=>Array.from({length:20}).map(()=>({
left:Math.random()*100,
top:Math.random()*80,
delay:Math.random()*5
})),
[]
);



useEffect(()=>{
loadInventory();
},[]);



async function loadInventory(){

const {data,error}=await supabase

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





async function refreshMarket() {

  setRefreshing(true);

  try {

    const response = await fetch("/api/update-prices", {
      method: "POST",
    });

    const result = await response.json();

    console.log(result);

    if (!response.ok) {
      alert(result.error || "Failed to update prices.");
      return;
    }

    await loadInventory();

    alert("Market values updated!");

  } catch (err) {

    console.error(err);
    alert("API request failed.");

  } finally {

    setRefreshing(false);

  }

}




function rarityStyle(rarity:string){

const r=rarity?.toLowerCase() || "";


if(r.includes("secret"))

return {

border:"border-indigo-300",

glow:"shadow-[0_0_45px_rgba(99,102,241,.45)]",

bg:"bg-indigo-50"

};



if(r.includes("illustration"))

return {

border:"border-pink-300",

glow:"shadow-[0_0_45px_rgba(236,72,153,.45)]",

bg:"bg-pink-50"

};



if(r.includes("ultra"))

return {

border:"border-purple-300",

glow:"shadow-[0_0_45px_rgba(168,85,247,.45)]",

bg:"bg-purple-50"

};



if(r.includes("rare"))

return {

border:"border-yellow-300",

glow:"shadow-[0_0_45px_rgba(234,179,8,.45)]",

bg:"bg-yellow-50"

};



return {

border:"border-emerald-200",

glow:"shadow-[0_0_35px_rgba(16,185,129,.25)]",

bg:"bg-emerald-50"

};


}





const filtered=inventory.filter(item=>

item.pokemon_cards?.name

?.toLowerCase()

.includes(
search.toLowerCase()
)

);





const totalVisitors=inventory.reduce(
(a,b)=>a+Number(b.quantity||0),
0
);



const totalTreasure=inventory.reduce(
(a,b)=>

a+

Number(b.quantity||0)

*

Number(
b.pokemon_cards?.market_value || 0
),

0
);






return (

<main className="

relative

min-h-screen

overflow-hidden

bg-gradient-to-br

from-green-100

via-yellow-50

to-purple-100

p-4
pb-28
md:p-8
md:pb-8

">


<ForestBackground />



<div className="absolute inset-0 pointer-events-none">

{

fireflies.map((f,i)=>(

<div

key={i}

className="

absolute

w-2

h-2

rounded-full

bg-yellow-300

shadow-[0_0_18px_8px_rgba(250,204,21,.7)]

animate-pulse

"

style={{

left:`${f.left}%`,

top:`${f.top}%`,

animationDelay:`${f.delay}s`

}}

/>

))

}

</div>






<div className="relative z-10 max-w-7xl mx-auto">


<AdminNav />





<section className="

mt-8

bg-white

rounded-[3rem]

shadow-xl

border

border-emerald-200

p-10

text-center

">


<h1 className="

text-5xl

font-black

text-emerald-950

">

Forest Visitors

</h1>



<p className="

mt-4

text-xl

font-bold

text-emerald-700

">

{totalVisitors.toLocaleString()} visitors

</p>





<div className="

mt-10

flex

flex-col

md:flex-row

justify-center

gap-12

items-center

">


<div className="

bg-yellow-100

border

border-yellow-300

rounded-3xl

px-10

py-6

">


<p className="text-sm font-bold uppercase text-yellow-700">

Forest Treasure

</p>


<p className="text-4xl font-black text-yellow-950">

£{totalTreasure.toFixed(2)}

</p>


</div>





<button

onClick={refreshMarket}

disabled={refreshing}

className="

bg-emerald-100

hover:bg-emerald-200

border

border-emerald-300

text-emerald-950

rounded-3xl

px-10

py-6

font-black

shadow-md

"

>

{

refreshing

?

"Updating..."

:

"Refresh Market Values"

}

</button>



</div>


</section>






<input

value={search}

onChange={(e)=>setSearch(e.target.value)}

placeholder="Search visitors..."

className="

mt-10

w-full

rounded-3xl

p-5

bg-white

text-black

shadow-xl

border

border-emerald-200

font-semibold

"

/>








{

loading ?


<div className="text-center mt-10">

Growing forest...

</div>



:


<div className="

grid

grid-cols-1

sm:grid-cols-2

lg:grid-cols-4

gap-8

mt-10

">


{

filtered.map((item:any)=>{


const card=item.pokemon_cards;

const rarity=rarityStyle(card?.rarity);



return (

<div

key={item.id}

className={`

bg-

rounded-[2.5rem]

overflow-hidden

border-2

${rarity.border}

${rarity.glow}

transition

hover:-translate-y-3

duration-300

`}

>


<img

src={card.image_url}

className="

w-full

aspect-[3/4]

object-cover

"

/>





<div className="p-6">


<h2 className="

text-2xl

font-black

text-gray-950

">

{card.name}

</h2>



<p className="font-semibold text-gray-700">

{card.set_name} #{card.card_no}

</p>





<div className={`

mt-3

inline-block

rounded-full

px-4

py-2

font-bold

text-black

${rarity.bg}

`}
>
{card.rarity}
</div>





<div className="

mt-5

rounded-3xl

bg-gray-50

p-5

space-y-3

font-semibold

text-black

">


<p>
Quantity:
<b> {item.quantity}</b>
</p>


<p>
Market Value:
<b>
£{Number(card.market_value||0).toFixed(2)}
</b>
</p>


<p>
Total Treasure:
<b>
£{(
Number(item.quantity)
*
Number(card.market_value||0)
).toFixed(2)}
</b>
</p>


</div>





<div className="

mt-5

grid

grid-cols-2

gap-3

">


<button

onClick={()=>updateQuantity(
item.id,
-1,
item.quantity
)}

className="

rounded-2xl

bg-red-100

text-red-900

font-black

py-3

"

>

-

</button>




<button

onClick={()=>updateQuantity(
item.id,
1,
item.quantity
)}

className="

rounded-2xl

bg-emerald-100

text-emerald-950

font-black

py-3

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

bg-gray-900

text-white

py-3

font-bold

"

>

Remove

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
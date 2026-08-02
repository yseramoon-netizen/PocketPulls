"use client";

type VisitorCardProps = {
  item:any;
  onClick?:()=>void;
};



export default function VisitorCard({
  item,
  onClick
}:VisitorCardProps){


const card = item.pokemon_cards;



function rarityStyle(rarity:string){

const value = rarity?.toLowerCase() || "";



if(value.includes("secret")){

return {

border:
"border-indigo-300",

glow:
"shadow-[0_0_45px_rgba(129,140,248,0.5)]",

background:
"from-indigo-50 via-white to-purple-100",

icon:
"🌙"

};

}



if(value.includes("ultra")){

return {

border:
"border-purple-300",

glow:
"shadow-[0_0_45px_rgba(168,85,247,0.5)]",

background:
"from-purple-50 via-white to-pink-100",

icon:
"✨"

};

}



if(value.includes("rare")){

return {

border:
"border-yellow-300",

glow:
"shadow-[0_0_45px_rgba(250,204,21,0.45)]",

background:
"from-yellow-50 via-white to-orange-50",

icon:
"🌸"

};

}



return {

border:
"border-green-200",

glow:
"shadow-[0_15px_40px_rgba(34,197,94,0.15)]",

background:
"from-green-50 via-white to-lime-50",

icon:
"🍃"

};


}



const theme = rarityStyle(card?.rarity);





return (

<div

onClick={onClick}

className={`

group

relative

cursor-pointer

overflow-hidden

rounded-[2.8rem]

border-2

${theme.border}

bg-gradient-to-br

${theme.background}

${theme.glow}

transition-all

duration-500

hover:-translate-y-3

hover:scale-[1.03]

`}

>



{/* magical floating symbol */}

<div

className="

absolute

top-4

right-5

text-2xl

opacity-70

group-hover:animate-bounce

"

>

{theme.icon}

</div>





{/* fairy glow */}

<div

className="

absolute

inset-0

bg-gradient-to-br

from-white/40

to-transparent

pointer-events-none

"

/>






<div className="p-5">





<div

className="

relative

rounded-[2rem]

overflow-hidden

shadow-lg

"

>

<img

src={card?.image_url}

alt={card?.name}

className="

w-full

aspect-[3/4]

object-cover

transition

duration-500

group-hover:scale-105

"

/>



</div>








<div className="mt-5">


<h2

className="

text-2xl

font-bold

text-emerald-950

"

>

{card?.name}

</h2>



<p

className="

text-gray-600

text-sm

mt-1

"

>

{card?.set_name}

{" "}

#{card?.card_no}

</p>







<div

className="

mt-3

inline-flex

items-center

gap-2

rounded-full

bg-white/70

px-4

py-1

text-sm

font-bold

text-emerald-800

"

>

{theme.icon}

{card?.rarity}

</div>





</div>









<div

className="

mt-5

space-y-3

rounded-3xl

bg-white/60

backdrop-blur

p-4

"

>


<div className="flex justify-between">

<span>

🌱 Population

</span>


<b>

{item.quantity}

</b>

</div>





<div className="flex justify-between">

<span>

💎 Treasure

</span>


<b>

£{Number(card?.market_value || 0).toFixed(2)}

</b>

</div>






<div className="flex justify-between">

<span>

📍 Grove

</span>


<b>

{item.location || "Wild Forest"}

</b>

</div>




</div>









<div

className="

mt-5

rounded-2xl

bg-gradient-to-r

from-emerald-100

to-lime-100

p-3

text-center

font-bold

text-emerald-950

"

>


Visitor Treasure


<div className="text-xl">


£

{(

Number(item.quantity || 0)

*

Number(card?.market_value || 0)

).toFixed(2)}


</div>


</div>








</div>


</div>

);


}
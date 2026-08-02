"use client";


type Props={

recent:any[];

};



export default function DiscoveryLog({

recent

}:Props){



return (

<section

className="

mt-10

rounded-[3rem]

bg-white/70

backdrop-blur-xl

border

border-white

shadow-xl

p-8

"

>


<h2

className="

text-3xl

font-black

text-emerald-950

"

>

📜 Forest Discovery Journal

</h2>





<div className="space-y-4 mt-6">


{

recent.map((item)=>{


const card = Array.isArray(item.pokemon_cards)

?

item.pokemon_cards[0]

:

item.pokemon_cards;



return (

<div

key={item.id}

className="

flex

items-center

gap-5

rounded-3xl

bg-gradient-to-r

from-green-50

to-pink-50

p-4

"

>


<img

src={card?.image_url}

className="

w-16

h-20

rounded-xl

object-cover

shadow

"

/>




<div>


<h3 className="font-black text-lg">

✨ {card?.name}

</h3>


<p className="text-gray-600">

{

item.profiles?.name==="Skye"

?

"🌸"

:

"🌙"

}

{" "}

{item.profiles?.name || "Trainer"}{" "}

discovered this Pokémon

</p>



<p className="text-sm text-gray-500">

📦 {item.location || "Forest"}

</p>


</div>


</div>


)


})

}


</div>


</section>

);


}
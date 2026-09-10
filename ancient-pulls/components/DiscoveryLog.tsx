"use client";

type Props = {
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

relative

overflow-hidden

bg-gradient-to-br

from-white/15

via-emerald-900/20

to-emerald-950/40

backdrop-blur-3xl

border

border-white/20

shadow-[0_30px_100px_rgba(16,185,129,0.25)]

p-8

"

>


{/* glass reflection */}

<div

className="

absolute

inset-0

bg-gradient-to-br

from-white/10

via-transparent

to-emerald-400/10

pointer-events-none

"

/>





<div className="relative z-10">


<h2

className="

text-3xl

font-black

text-white

"

>

📜 Forest Discovery Journal

</h2>


<p

className="

mt-2

text-emerald-200/70

font-semibold

"

>

Recent Pokémon discoveries within the sanctuary

</p>






<div

className="

space-y-4

mt-6

"

>


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

group

flex

items-center

gap-5

rounded-3xl

bg-white/10

border

border-white/20

backdrop-blur-2xl

p-4

transition-all

duration-300

hover:bg-white/20

hover:-translate-y-1

hover:shadow-[0_20px_50px_rgba(52,211,153,0.2)]

"

>





<div

className="

w-20

h-24

rounded-2xl

bg-white/10

border

border-white/20

overflow-hidden

flex

items-center

justify-center

shadow-[0_0_25px_rgba(52,211,153,0.2)]

"

>


<img

src={card?.image_url}

className="

w-full

h-full

object-cover

group-hover:scale-105

transition

duration-300

"

/>


</div>







<div>


<h3

className="

font-black

text-lg

text-white

"

>

✨ {card?.name}

</h3>




<p

className="

text-emerald-100/80

"

>

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





<p

className="

text-sm

text-emerald-200/60

mt-1

"

>

📦 {item.location || "Forest"}

</p>



</div>





</div>


)


})

}


</div>


</div>


</section>


);


}
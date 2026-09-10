"use client";

type Props = {
  cards:number;
  value:number;
  locations:number;
};


export default function ForestStats({

  cards,
  value,
  locations

}:Props){


const stats=[

{
icon:"🌿",
title:"Forest Life",
value:cards.toLocaleString(),
text:"Pokémon living here"
},

{
icon:"💎",
title:"Treasures",
value:`£${value.toFixed(2)}`,
text:"Estimated forest value"
},

{
icon:"🏡",
title:"Boxes",
value:locations,
text:"Storage locations"
}

];



return (

<section

className="

grid

grid-cols-1

md:grid-cols-3

gap-6

mt-10

"

>


{

stats.map((stat)=>(


<div

key={stat.title}

className="

group

relative

overflow-hidden

rounded-[2.5rem]

bg-gradient-to-br

from-white/15

via-white/10

to-emerald-900/20

backdrop-blur-3xl

border

border-white/20

shadow-[0_25px_70px_rgba(16,185,129,0.18)]

p-7

transition-all

duration-500

hover:-translate-y-3

hover:shadow-[0_35px_90px_rgba(52,211,153,0.35)]

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

to-emerald-400/10

opacity-70

pointer-events-none

"

/>




<div

className="

relative

z-10

"

>


<div

className="

w-16

h-16

rounded-3xl

bg-emerald-400/20

backdrop-blur-xl

border

border-white/20

flex

items-center

justify-center

text-4xl

shadow-[0_0_35px_rgba(52,211,153,0.35)]

"

>

{stat.icon}

</div>





<h3

className="

mt-5

text-xl

font-black

text-white

"

>

{stat.title}

</h3>





<p

className="

text-4xl

font-black

text-emerald-100

mt-2

"

>

{stat.value}

</p>





<p

className="

text-emerald-200/70

mt-2

"

>

{stat.text}

</p>


</div>





{/* energy line */}

<div

className="

absolute

bottom-0

left-0

right-0

h-1

bg-gradient-to-r

from-emerald-300/20

via-emerald-400

to-emerald-300/20

shadow-[0_0_20px_rgba(52,211,153,0.8)]

"

/>



</div>


))

}


</section>


);


}
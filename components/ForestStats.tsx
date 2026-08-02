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

relative

overflow-hidden

rounded-[2.5rem]

bg-white/70

backdrop-blur-xl

border

border-white

shadow-xl

p-7

hover:-translate-y-2

transition

duration-300

"

>


<div className="text-5xl">

{stat.icon}

</div>



<h3 className="

mt-5

text-xl

font-black

text-emerald-950

">

{stat.title}

</h3>




<p className="

text-4xl

font-black

text-emerald-700

mt-2

">

{stat.value}

</p>




<p className="text-gray-600 mt-2">

{stat.text}

</p>




<div

className="

absolute

bottom-0

left-0

right-0

h-2

bg-gradient-to-r

from-lime-300

to-emerald-500

"

/>



</div>


))

}


</section>


);


}
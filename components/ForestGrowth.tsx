"use client";

type Props = {
  Lukas:number;
  Skye:number;
};


export default function ForestGrowth({

  Lukas,

  Skye

}:Props){



const total = Lukas + Skye;



const progress = Math.min(

(total / 10000) * 100,

100

);





function forestStage(){


if(total < 100)

return "🌱";


if(total < 500)

return "🌿";


if(total < 2000)

return "🌳";


return "🌲✨";


}






return (

<section

className="

mt-10

rounded-[3rem]

bg-gradient-to-br

from-emerald-50

via-green-50

to-lime-100

border

border-green-200

shadow-xl

p-8

text-center

overflow-hidden

relative

"

>


<div className="absolute top-5 left-5 text-3xl opacity-40">

🍃

</div>


<div className="absolute bottom-5 right-5 text-3xl opacity-40">

🌸

</div>





<h2 className="

text-3xl

font-black

text-emerald-900

">

🌲 PocketPulls Grove

</h2>





<div className="

text-8xl

mt-6

animate-pulse

">

{forestStage()}

</div>






<p className="

text-xl

font-bold

text-emerald-700

mt-4

">

{total.toLocaleString()} Pokémon planted

</p>







<div className="

mt-8

h-6

bg-green-200

rounded-full

overflow-hidden

"

>


<div

className="

h-full

bg-gradient-to-r

from-lime-300

via-green-400

to-emerald-600

rounded-full

transition-all

duration-1000

"

style={{

width:`${progress}%`

}}


/>


</div>






<div className="

grid

grid-cols-2

gap-5

mt-8

">


<div

className="

bg-white/70

rounded-3xl

p-5

shadow

"

>


<p className="text-3xl">

🌙

</p>


<p className="font-bold text-emerald-900">

Lukas

</p>


<p className="text-xl font-black">

{Lukas.toLocaleString()}

</p>


<p className="text-sm text-gray-600">

cards planted

</p>


</div>






<div

className="

bg-white/70

rounded-3xl

p-5

shadow

"

>


<p className="text-3xl">

🌸

</p>


<p className="font-bold text-purple-900">

Skye

</p>


<p className="text-xl font-black">

{Skye.toLocaleString()}

</p>


<p className="text-sm text-gray-600">

cards planted

</p>


</div>


</div>






</section>


);


}
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

text-center

"

>


{/* glass reflection */}

<div

className="

absolute

inset-0

bg-gradient-to-br

from-white/15

via-transparent

to-emerald-400/10

pointer-events-none

"

/>



<div className="absolute top-5 left-5 text-3xl opacity-40">
🍃
</div>


<div className="absolute bottom-5 right-5 text-3xl opacity-40">
🌸
</div>




<div className="relative z-10">


<h2

className="

text-3xl

font-black

text-white

"

>

🌲 ancientpulls Grove

</h2>




<div

className="

mt-6

mx-auto

w-40

h-40

rounded-full

bg-emerald-400/20

border

border-white/20

backdrop-blur-xl

flex

items-center

justify-center

text-8xl

shadow-[0_0_70px_rgba(52,211,153,0.45)]

animate-pulse

"

>

{forestStage()}

</div>





<p

className="

text-xl

font-bold

text-emerald-100

mt-6

"

>

{total.toLocaleString()} Pokémon planted

</p>







<div

className="

mt-8

h-6

bg-white/10

border

border-white/20

rounded-full

overflow-hidden

backdrop-blur-xl

"

>


<div

className="

h-full

bg-gradient-to-r

from-emerald-300

via-green-400

to-emerald-500

rounded-full

shadow-[0_0_25px_rgba(52,211,153,0.9)]

transition-all

duration-1000

"

style={{

width:`${progress}%`

}}

/>


</div>







<div

className="

grid

grid-cols-1

md:grid-cols-2

gap-5

mt-8

"

>





<div

className="

rounded-3xl

bg-white/10

border

border-white/20

backdrop-blur-2xl

p-5

shadow-[0_0_35px_rgba(52,211,153,0.15)]

"

>


<p className="text-3xl">
🌙
</p>


<p className="font-bold text-white">
Lukas
</p>


<p className="text-2xl font-black text-emerald-100">
{Lukas.toLocaleString()}
</p>


<p className="text-sm text-emerald-200/70">
cards planted
</p>


</div>







<div

className="

rounded-3xl

bg-white/10

border

border-white/20

backdrop-blur-2xl

p-5

shadow-[0_0_35px_rgba(236,72,153,0.15)]

"

>


<p className="text-3xl">
🌸
</p>


<p className="font-bold text-white">
Skye
</p>


<p className="text-2xl font-black text-emerald-100">
{Skye.toLocaleString()}
</p>


<p className="text-sm text-emerald-200/70">
cards planted
</p>


</div>



</div>


</div>


</section>


);

}
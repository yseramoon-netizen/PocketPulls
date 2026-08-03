"use client";



interface PullMachineProps {

  opening:boolean;

  stage:string;

  progress:number;

}





export default function PullMachine({

  opening,

  stage,

  progress

}:PullMachineProps){





const particles = [

  [10,20],
  [25,80],
  [40,15],
  [55,65],
  [70,30],
  [85,75],
  [15,55],
  [35,90],
  [60,45],
  [90,10],
  [75,55],
  [50,25],
  [20,40],
  [65,85],
  [95,60],
  [30,10],
  [80,90],
  [45,70],
  [12,85],
  [88,35],
  [55,95],
  [72,15],
  [38,50],
  [92,80],
  [5,45],
  [60,5],
  [28,65],
  [82,40],
  [48,30],
  [68,75],

];





return (

<section

className={`

mt-10

relative

overflow-hidden

rounded-[3rem]

min-h-[420px]

flex

items-center

justify-center


bg-black/40

backdrop-blur-3xl


border

border-emerald-400/20


shadow-[0_0_120px_rgba(16,185,129,.35)]


transition-all

duration-700


${

opening

?

"opacity-100 scale-100"

:

"opacity-0 scale-95"

}

`}

>





{/* glow */}


<div

className="

absolute

w-96

h-96

bg-emerald-400/20

rounded-full

blur-3xl

animate-pulse

"

/>







{/* particles */}


{

particles.map((particle,i)=>(


<div

key={i}

className="

absolute

w-2

h-2

rounded-full

bg-yellow-300

shadow-[0_0_20px_rgba(250,204,21,.9)]

animate-pulse

"

style={{

left:`${particle[0]}%`,

top:`${particle[1]}%`,

animationDelay:`${i*0.12}s`

}}

/>


))

}









{/* Tree energy circle */}


<div

className="

relative

z-10

flex

flex-col

items-center

"

>





<div

className="

relative

w-56

h-56

rounded-full


bg-gradient-to-br

from-emerald-300/30

via-green-500/20

to-yellow-300/30


border

border-white/20


backdrop-blur-xl


flex

items-center

justify-center


shadow-[0_0_80px_rgba(16,185,129,.7)]

"

>



<div

className="

text-8xl

animate-bounce

"

>

🌳

</div>




</div>









<div

className="

mt-8

text-center

"

>



<h2

className="

text-3xl

font-black

text-white

"

>

{stage}

</h2>




<p

className="

mt-3

text-emerald-200

font-bold

"

>

Ancient Pokémon energy is forming...

</p>



</div>









{/* progress */}


<div

className="

mt-8

w-80

h-4

rounded-full

bg-white/10

overflow-hidden

border

border-white/20

"

>


<div

className="

h-full

bg-gradient-to-r

from-yellow-300

via-emerald-400

to-green-500

transition-all

duration-300

"

style={{

width:`${progress}%`

}}

/>


</div>





<p

className="

mt-3

text-white

font-black

"

>

{progress}%

</p>





</div>






</section>

);


}
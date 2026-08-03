"use client";

type Props = {
  opening:boolean;
  stage:string;
  progress:number;
};


export default function PullMachine({
  opening,
  stage,
  progress
}:Props){


return (

<section

className="

relative

overflow-hidden

rounded-[4rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

shadow-[0_0_100px_rgba(16,185,129,.35)]

p-10

text-center

"

>


{/* Forest energy */}

<div

className="

absolute

inset-0

bg-gradient-to-br

from-emerald-400/20

via-transparent

to-yellow-300/10

"

/>





{/* Floating particles */}

{

Array.from({length:18}).map((_,i)=>(

<div

key={i}

className="

absolute

w-2

h-2

rounded-full

bg-yellow-300

shadow-[0_0_25px_10px_rgba(250,204,21,.8)]

animate-pulse

"

style={{

left:`${10 + (i*5)%80}%`,

top:`${15 + (i*13)%65}%`,

animationDelay:`${i*0.2}s`

}}

/>

))

}





<div className="relative z-10">



<div

className={`

mx-auto

w-52

h-52

rounded-full

flex

items-center

justify-center


bg-emerald-400/20

border

border-emerald-200/40


shadow-[0_0_80px_rgba(52,211,153,.6)]


${opening ? "animate-pulse" : ""}

`

}

>



<div

className="

text-8xl

animate-bounce

"

>

🌿

</div>


</div>







<h2

className="

mt-8

text-3xl

font-black

text-white

"

>

The forest is awakening...

</h2>





<p

className="

mt-4

text-xl

font-bold

text-emerald-100

min-h-8

"

>

{stage}

</p>








<div

className="

mt-8

max-w-xl

mx-auto

h-5

rounded-full

bg-black/30

overflow-hidden

border

border-white/20

"

>


<div

className="

h-full

rounded-full

bg-gradient-to-r

from-lime-300

via-emerald-400

to-yellow-300

transition-all

duration-300

shadow-[0_0_30px_rgba(52,211,153,.8)]

"

style={{

width:`${progress}%`

}}

/>


</div>





<p

className="

mt-4

text-emerald-200

font-black

text-lg

"

>

{progress}%

</p>





</div>


</section>

);


}
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



if(!opening){

return null;

}



return(


<section

className="
relative
w-full
max-w-2xl
h-[520px]

mx-auto

overflow-hidden

rounded-[4rem]

bg-black/40

backdrop-blur-2xl

border

border-emerald-400/20

shadow-[0_0_120px_rgba(16,185,129,.35)]

flex

items-center

justify-center

"

>



{/* forest glow */}

<div

className="

absolute

inset-0

bg-gradient-to-b

from-emerald-900/40

via-black

to-black

"

/>






{/* floating particles */}

{

Array.from({length:35}).map((_,i)=>(


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

left:`${Math.random()*100}%`,

top:`${Math.random()*100}%`,

animationDelay:`${i*0.15}s`

}}

/>


))

}









<div

className="
relative
z-10
flex
flex-col
items-center
"

>







{/* Tree */}

<div

className={`

relative

transition-all

duration-1000


${progress>40

?

"scale-110"

:

"scale-100"

}

`}

>





{/* tree glow */}

<div

className="

absolute

inset-0

bg-emerald-400/30

blur-3xl

rounded-full

animate-pulse

"

/>





{/* trunk */}

<div

className="

relative

text-[160px]

leading-none

select-none

"

>

🌳

</div>





{/* blooming card */}

{

progress>75 && (

<div

className="

absolute

top-0

left-1/2

-translate-x-1/2

text-7xl

animate-bounce

"

>

🎴

</div>

)

}



</div>









<h2

className="

mt-10

text-center

text-3xl

md:text-4xl

font-black

text-white

animate-pulse

"

>

{stage}

</h2>







{/* energy bar */}

<div

className="

mt-8

w-72

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

rounded-full

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

mt-5

text-emerald-200

font-bold

"

>

Forest energy: {progress}%

</p>






</div>





</section>


);


}
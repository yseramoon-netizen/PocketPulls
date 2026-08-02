"use client";

import { useEffect, useState } from "react";


export default function PullAnimation({

stage

}:{

stage:string

}){


const [phase,setPhase]=useState(0);



useEffect(()=>{


const timers=[

setTimeout(()=>setPhase(1),700),

setTimeout(()=>setPhase(2),1800),

setTimeout(()=>setPhase(3),3000),

setTimeout(()=>setPhase(4),4000)

];


return()=>{

timers.forEach(clearTimeout);

};


},[]);





return(

<section className="
relative
overflow-hidden

min-h-[520px]

rounded-[3rem]

bg-gradient-to-b
from-[#022c22]
via-[#052e16]
to-black

border
border-emerald-400/20

shadow-[0_0_100px_rgba(16,185,129,.4)]

flex
items-center
justify-center

"

>



{/* magical glow */}

<div className="
absolute
inset-0

bg-[radial-gradient(circle_at_center,rgba(250,204,21,.25),transparent_40%)]

"

/>







{/* floating particles */}

{

Array.from({
length:35
}).map((_,i)=>(


<div

key={i}

className="
absolute

w-2
h-2

rounded-full

bg-yellow-300

animate-pulse

shadow-[0_0_20px_rgba(250,204,21,.9)]

"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*100}%`,

animationDelay:`${i*.15}s`

}}

/>


))

}










<div className="
relative
z-10
text-center
">





<p className="
text-emerald-200

font-black

tracking-widest

uppercase

animate-pulse

">

{stage}

</p>








{/* seed */}

{

phase < 1 &&

<div className="
mt-16
text-7xl
animate-bounce
">

🌱

</div>

}








{/* growing tree */}

{

phase >=1 && phase <4 &&

<div className="
mt-10
relative
flex
justify-center
items-center

">


<div className="

text-[150px]

animate-pulse

drop-shadow-[0_0_40px_rgba(16,185,129,.8)]

">

🌳

</div>



</div>


}










{/* blooming card */}

{

phase >=4 &&

<div className="
mt-10
animate-[bounce_1s_infinite]

">


<div className="
relative

mx-auto

w-64
h-96

rounded-[2rem]

bg-gradient-to-br

from-yellow-300

via-purple-500

to-emerald-400

p-1

shadow-[0_0_100px_rgba(250,204,21,.9)]

"

>


<div className="
w-full
h-full

rounded-[1.8rem]

bg-black

flex
items-center
justify-center

text-8xl

"

>

🎴

</div>


</div>



</div>

}



</div>






</section>


);


}
"use client";

import { useMemo } from "react";


export default function ForestAtmosphere(){


const fireflies = useMemo(()=>{

return Array.from({length:25});

},[]);



const leaves = useMemo(()=>{

return Array.from({length:18});

},[]);



return (

<div

className="

absolute

inset-0

overflow-hidden

pointer-events-none

z-0

"

>


{/* Moon glow */}

<div

className="

absolute

top-10

right-20

w-52

h-52

rounded-full

bg-yellow-100/40

blur-3xl

"

/>





{/* distant trees */}

<div

className="

absolute

bottom-0

left-0

right-0

flex

justify-between

items-end

opacity-20

"

>


{Array.from({length:8}).map((_,i)=>(


<div

key={i}

className="

text-[120px]

animate-pulse

"

style={{

animationDelay:`${i*0.4}s`

}}

>

🌲

</div>


))}


</div>







{/* Growing grass */}

<div

className="

absolute

bottom-0

left-0

right-0

h-28

flex

items-end

justify-around

"

>


{Array.from({length:40}).map((_,i)=>(


<div

key={i}

className="

text-green-500/40

text-3xl

origin-bottom

animate-[grass_4s_ease-in-out_infinite]

"

style={{

animationDelay:`${i*0.1}s`

}}

>

🌱

</div>


))}


</div>








{/* Floating leaves */}


{

leaves.map((_,i)=>(


<div

key={i}

className="

absolute

text-xl

opacity-40

animate-[float_12s_linear_infinite]

"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*80}%`,

animationDelay:`${i}s`

}}

>

🍃

</div>


))


}










{/* Fireflies */}


{

fireflies.map((_,i)=>(


<div

key={i}

className="

absolute

w-2

h-2

rounded-full

bg-yellow-300

shadow-[0_0_15px_5px_rgba(253,224,71,0.7)]

animate-[firefly_5s_ease-in-out_infinite]

"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*70}%`,

animationDelay:`${i*0.3}s`

}}

>


</div>


))


}



</div>


);


}
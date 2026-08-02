"use client";

import { useMemo } from "react";


export default function ForestBackground(){


const fireflies = useMemo(
()=>Array.from({length:35}),
[]
);


const leaves = useMemo(
()=>Array.from({length:20}),
[]
);



return (

<div className="
absolute
inset-0
overflow-hidden
pointer-events-none
z-0
">


{/* Moon glow */}

<div className="
absolute
top-10
right-16
w-72
h-72
rounded-full
bg-yellow-100/40
blur-3xl
"/>





{/* Mist */}

<div className="
absolute
bottom-20
left-0
right-0
h-32
bg-white/20
blur-3xl
"/>







{/* Far forest */}

<div className="
absolute
bottom-0
left-0
right-0
flex
justify-around
items-end
opacity-20
blur-[1px]
">


{
Array.from({length:12}).map((_,i)=>(


<div

key={i}

className="
text-[100px]
"

>

🌲

</div>


))
}


</div>









{/* Middle forest */}

<div className="
absolute
bottom-0
left-0
right-0
flex
justify-between
opacity-30
">


{
Array.from({length:7}).map((_,i)=>(


<div

key={i}

className="
text-[150px]
"

>

🌳

</div>


))
}


</div>









{/* Grass */}

<div className="
absolute
bottom-0
left-0
right-0
h-28
flex
justify-around
items-end
">


{
Array.from({length:45}).map((_,i)=>(


<div

key={i}

className="
text-3xl
text-green-500/40
animate-pulse
"

style={{

animationDelay:`${i*0.1}s`

}}

>

🌱

</div>


))
}


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
animate-bounce
"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*70}%`,

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
shadow-[0_0_20px_8px_rgba(253,224,71,.8)]
animate-pulse
"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*80}%`,

animationDelay:`${i*.3}s`

}}

>


</div>


))


}






</div>


);

}
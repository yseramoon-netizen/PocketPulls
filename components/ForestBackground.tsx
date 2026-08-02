"use client";

import { useMemo } from "react";


export default function ForestBackground(){


const fireflies = useMemo(()=>[

{left:8, top:20},
{left:15, top:55},
{left:22, top:35},
{left:31, top:70},
{left:42, top:25},
{left:50, top:60},
{left:63, top:40},
{left:72, top:18},
{left:81, top:65},
{left:91, top:30},
{left:12, top:75},
{left:37, top:50},
{left:57, top:75},
{left:77, top:55},
{left:95, top:70},
{left:28, top:15},
{left:68, top:75},
{left:88, top:45},
{left:45, top:80},
{left:5, top:40},
{left:18, top:65},
{left:35, top:30},
{left:60, top:20},
{left:85, top:75},
{left:96, top:15},

],[]);




const leaves = useMemo(()=>[

{left:10,top:25},
{left:25,top:45},
{left:40,top:15},
{left:55,top:60},
{left:70,top:30},
{left:85,top:50},
{left:15,top:70},
{left:35,top:55},
{left:60,top:40},
{left:90,top:25},

{left:5,top:60},
{left:45,top:75},
{left:75,top:65},
{left:95,top:45},
{left:30,top:20},
{left:65,top:15},
{left:80,top:75},
{left:20,top:35},
{left:50,top:50},
{left:88,top:20},

],[]);




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
right-16
w-72
h-72
rounded-full
bg-yellow-100/40
blur-3xl
"
/>





{/* Mist */}

<div
className="
absolute
bottom-20
left-0
right-0
h-32
bg-white/20
blur-3xl
"
/>






{/* Far forest */}

<div
className="
absolute
bottom-0
left-0
right-0
flex
justify-around
items-end
opacity-20
blur-[1px]
"
>

{

Array.from({length:12}).map((_,i)=>(

<div
key={i}
className="text-[100px]"
>
🌲
</div>

))

}

</div>








{/* Middle forest */}

<div
className="
absolute
bottom-0
left-0
right-0
flex
justify-between
opacity-30
"
>

{

Array.from({length:7}).map((_,i)=>(

<div
key={i}
className="text-[150px]"
>
🌳
</div>

))

}

</div>









{/* Grass */}

<div
className="
absolute
bottom-0
left-0
right-0
h-28
flex
justify-around
items-end
"
>

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

leaves.map((leaf,i)=>(

<div

key={i}

className="
absolute
text-xl
opacity-40
animate-bounce
"

style={{

left:`${leaf.left}%`,

top:`${leaf.top}%`,

animationDelay:`${i}s`

}}

>

🍃

</div>


))

}










{/* Fireflies */}

{

fireflies.map((fly,i)=>(

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

left:`${fly.left}%`,

top:`${fly.top}%`,

animationDelay:`${i*0.3}s`

}}

>

</div>


))

}





</div>

);


}
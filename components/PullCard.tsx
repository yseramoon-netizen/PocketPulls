"use client";

import { useEffect, useState } from "react";


export default function PullCard({
  card
}:{
  card:any
}){


const [show,setShow]=useState(false);

const [value,setValue]=useState(0);



useEffect(()=>{


setShow(false);


setTimeout(()=>{

setShow(true);

},100);



let target =
Number(card.market_value || 0);



let current=0;



const interval=setInterval(()=>{


current += target / 35;



if(current >= target){

current = target;

clearInterval(interval);

}



setValue(current);



},35);




return()=>clearInterval(interval);



},[card]);








function rarity(){


const r =
card.rarity?.toLowerCase() || "";



if(r.includes("secret"))

return {

name:"SECRET RARE",

color:
"from-yellow-300 via-purple-500 to-pink-500",

glow:
"rgba(250,204,21,.8)"

};



if(r.includes("illustration"))

return {

name:"ILLUSTRATION RARE",

color:
"from-pink-400 via-purple-500 to-blue-500",

glow:
"rgba(236,72,153,.8)"

};



if(r.includes("ultra"))

return {

name:"ULTRA RARE",

color:
"from-purple-400 via-blue-500 to-cyan-400",

glow:
"rgba(59,130,246,.8)"

};



if(r.includes("rare"))

return {

name:"RARE",

color:
"from-yellow-300 to-orange-400",

glow:
"rgba(250,204,21,.7)"

};



return {

name:"DISCOVERY",

color:
"from-emerald-300 to-green-500",

glow:
"rgba(16,185,129,.7)"

};



}





const rarityData = rarity();







return(


<section

className={`

relative

w-full

flex

justify-center

transition-all

duration-1000


${show

?

"opacity-100 scale-100"

:

"opacity-0 scale-90"

}

`

}

>



{/* aura */}


<div

className="

absolute

w-96

h-96

rounded-full

blur-3xl

opacity-40

animate-pulse

"

style={{

background:

`radial-gradient(circle,${rarityData.glow},transparent)`

}}

/>






<div

className={`

relative

max-w-md

w-full

rounded-[3rem]

p-[3px]

bg-gradient-to-br

${rarityData.color}

shadow-2xl

`

}

>





{/* moving holographic light */}

<div

className="

absolute

inset-0

rounded-[3rem]

bg-gradient-to-r

from-transparent

via-white/60

to-transparent

translate-x-[-120%]

animate-[shine_2s_infinite]

"

/>







<div

className="

relative

rounded-[2.8rem]

bg-black/70

backdrop-blur-2xl

border

border-white/20

p-6

overflow-hidden

"

>





{/* top glass */}

<div

className="

flex

justify-between

items-center

"

>


<span

className="

bg-white/10

backdrop-blur-xl

border

border-white/20

text-white

px-4

py-2

rounded-full

text-xs

font-black

tracking-widest

"

>

NEW PULL

</span>





<span

className="

text-yellow-300

font-black

"

>

✦ {rarityData.name}

</span>



</div>








{/* card */}

<div

className="

mt-6

relative

rounded-3xl

overflow-hidden

shadow-[0_20px_60px_rgba(0,0,0,.6)]

animate-[float_3s_ease-in-out_infinite]

"

>


<img

src={card.image_url}

className="

w-full

rounded-3xl

"

 />



<div

className="

absolute

inset-0

bg-gradient-to-tr

from-white/20

via-transparent

to-transparent

pointer-events-none

"

/>


</div>









<h1

className="

mt-7

text-center

text-4xl

font-black

text-white

"

>

{card.name}

</h1>







<p

className="

mt-2

text-center

text-white/50

font-bold

"

>

{card.rarity}

</p>







<div

className="

mt-8

rounded-3xl

bg-white/10

border

border-white/20

backdrop-blur-xl

p-5

text-center

"

>


<p

className="

text-xs

uppercase

tracking-[0.3em]

text-white/40

font-black

"

>

Market Value

</p>




<p

className="

mt-2

text-5xl

font-black

text-yellow-300

"

>

£{value.toFixed(2)}

</p>


</div>








<button

className="

mt-6

w-full

py-5

rounded-3xl

bg-gradient-to-r

from-yellow-300

to-orange-400

text-black

font-black

text-lg

shadow-[0_0_40px_rgba(250,204,21,.5)]

hover:scale-105

transition

"

>

ADD TO COLLECTION

</button>







</div>





</div>




</section>


);


}
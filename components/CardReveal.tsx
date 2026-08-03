"use client";

import { useEffect, useState } from "react";


interface CardRevealProps{

card:any;

}



export default function CardReveal({

card

}:CardRevealProps){



const [show,setShow]=useState(false);

const [value,setValue]=useState(0);

const [bloom,setBloom]=useState(false);






useEffect(()=>{


setTimeout(()=>{

setBloom(true);

},300);



setTimeout(()=>{

setShow(true);

},900);





const target =
Number(card.market_value || 0);



let current=0;



const counter=setInterval(()=>{


current += target / 40;



if(current >= target){

current=target;

clearInterval(counter);

}



setValue(current);



},40);





return()=>clearInterval(counter);



},[card]);









function rarityStyle(){


const rarity =

(card.rarity || "")
.toLowerCase();




if(rarity.includes("secret")){


return{

label:"SECRET RARE",

gradient:
"from-yellow-300 via-pink-500 to-purple-600",

glow:
"shadow-[0_0_120px_rgba(250,204,21,.9)]"

};

}




if(rarity.includes("ultra")){


return{

label:"ULTRA RARE",

gradient:
"from-purple-400 via-blue-500 to-cyan-400",

glow:
"shadow-[0_0_100px_rgba(59,130,246,.8)]"

};

}





if(rarity.includes("illustration")){


return{

label:"ILLUSTRATION RARE",

gradient:
"from-pink-400 via-purple-500 to-blue-500",

glow:
"shadow-[0_0_100px_rgba(236,72,153,.8)]"

};

}





if(rarity.includes("rare")){


return{

label:"RARE",

gradient:
"from-yellow-300 to-orange-500",

glow:
"shadow-[0_0_80px_rgba(250,204,21,.7)]"

};

}





return{

label:"FOREST DISCOVERY",

gradient:
"from-emerald-300 to-green-600",

glow:
"shadow-[0_0_80px_rgba(16,185,129,.6)]"

};



}







const style = rarityStyle();







return(

<section

className="

relative

w-full

flex

justify-center

overflow-hidden

"

>







{/* forest atmosphere */}


<div

className="

absolute

inset-0

pointer-events-none

"

>



{

Array.from({length:30}).map((_,i)=>(


<div

key={i}

className="

absolute

w-2

h-2

rounded-full

bg-yellow-300

animate-pulse

shadow-[0_0_20px_5px_rgba(250,204,21,.7)]

"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*100}%`,

animationDelay:`${i*0.15}s`

}}

/>


))

}



</div>









<div

className={`

relative

transition-all

duration-1000

${

show

?

"opacity-100 translate-y-0"

:

"opacity-0 translate-y-20"

}

`

}

>







{/* tree glow */}


<div

className={`

absolute

-inset-20

rounded-full

bg-emerald-400/30

blur-3xl

transition

duration-1000

${

bloom

?

"scale-150"

:

"scale-50"

}

`

}

/>










{/* card frame */}


<div

className={`

relative

rounded-[3rem]

p-1

bg-gradient-to-br

${style.gradient}

${style.glow}

`

}

>








<div

className="

rounded-[2.8rem]

bg-black/70

backdrop-blur-xl

p-6

w-[340px]

"

>






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

px-4

py-2

rounded-full

text-xs

font-black

"

>

NEW DISCOVERY

</span>




<span

className="

text-yellow-300

font-black

"

>

✦ {style.label}

</span>



</div>









<img

src={card.image_url}

className="

mt-6

rounded-[2rem]

w-full

shadow-2xl

"

 />









<h1

className="

mt-6

text-center

text-4xl

font-black

"

>

{card.name}

</h1>








<p

className="

text-center

mt-2

text-emerald-200

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

p-5

text-center

"

>


<p

className="

text-xs

uppercase

tracking-widest

text-gray-300

font-bold

"

>

Market Value

</p>



<p

className="

text-5xl

font-black

text-yellow-300

mt-2

"

>

£{value.toFixed(2)}

</p>



</div>









<button

className="

mt-6

w-full

rounded-full

py-4

bg-gradient-to-r

from-yellow-300

to-orange-400

text-black

font-black

hover:scale-105

transition

"

>

✨ Add To Collection

</button>







</div>





</div>








</div>



</section>


);


}
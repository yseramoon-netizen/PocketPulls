"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";


interface CardRevealProps {

  card:any;

}



export default function CardReveal({

  card

}:CardRevealProps){


  const [show,setShow]=useState(false);



  useEffect(()=>{


    setShow(false);


    const timer=setTimeout(()=>{

      setShow(true);

    },300);



    return ()=>clearTimeout(timer);


  },[card]);






  if(!card)
  return null;







  function rarityStyle(rarity:string){


    const r =
    rarity?.toLowerCase() || "";



    if(r.includes("secret"))

    return {

      border:
      "from-purple-500 via-yellow-300 to-pink-500",

      glow:
      "shadow-[0_0_120px_rgba(250,204,21,.9)]"

    };



    if(
      r.includes("illustration")
    )

    return {

      border:
      "from-pink-400 via-purple-400 to-blue-400",

      glow:
      "shadow-[0_0_100px_rgba(168,85,247,.8)]"

    };



    if(
      r.includes("ultra")
    )

    return {

      border:
      "from-blue-400 via-purple-400 to-indigo-500",

      glow:
      "shadow-[0_0_90px_rgba(99,102,241,.8)]"

    };



    if(
      r.includes("rare")
    )

    return {

      border:
      "from-yellow-300 to-orange-400",

      glow:
      "shadow-[0_0_80px_rgba(250,204,21,.7)]"

    };



    return {

      border:
      "from-emerald-300 to-green-400",

      glow:
      "shadow-[0_0_60px_rgba(16,185,129,.5)]"

    };


  }





  const style =
  rarityStyle(card.rarity);









return (

<div

className="
relative
flex
justify-center
items-center
"

>


{/* particles */}

{

Array.from({
length:25
}).map((_,i)=>(


<motion.div

key={i}

initial={{

opacity:0,

scale:0

}}


animate={{

opacity:[0,1,0],

scale:[0,1.5,0],

y:-150,

x:
Math.random()*300-150

}}


transition={{

duration:2,

delay:i*.04

}}


className="
absolute
w-2
h-2
rounded-full
bg-yellow-300
shadow-[0_0_20px_8px_rgba(250,204,21,.8)]
"

/>


))

}





<motion.div


initial={{

rotateY:180,

scale:.4,

opacity:0

}}


animate={

show

?

{

rotateY:0,

scale:1,

opacity:1

}

:

{}

}


transition={{

duration:1,

type:"spring",

bounce:.4

}}



style={{

transformStyle:"preserve-3d"

}}


className={`
relative
p-2
rounded-[3rem]
bg-gradient-to-br
${style.border}
${style.glow}
w-full
max-w-sm
`}


>


<div

className="
bg-white
rounded-[2.7rem]
p-5
text-black
text-center
"

>



<img

src={card.image_url}

className="
rounded-3xl
shadow-xl
mx-auto
"

/>





<h1

className="
mt-6
text-4xl
font-black
"

>

{card.name}

</h1>





<p

className="
mt-3
text-lg
font-bold
text-gray-600
"

>

{card.rarity}

</p>





<div

className="
mt-5
bg-emerald-100
rounded-2xl
p-4
"

>


<p

className="
text-sm
font-bold
text-gray-500
"

>

Market Value

</p>


<p

className="
text-4xl
font-black
text-emerald-700
"

>

£{Number(card.market_value).toFixed(2)}

</p>


</div>






<button

className="
mt-5
w-full
py-3
rounded-2xl
bg-emerald-600
text-white
font-black
hover:scale-105
transition
"

>

🌿 Added to Collection

</button>



</div>



</motion.div>




</div>


);


}
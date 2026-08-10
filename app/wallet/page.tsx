"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import AdminNav from "@/components/AdminNav";
import ForestBackground from "@/components/ForestBackground";


export default function WalletPage(){


const [balance,setBalance]=useState(0);

const [loading,setLoading]=useState(true);



useEffect(()=>{

loadWallet();

},[]);





async function loadWallet(){


const {
data:{
user
}

}=await supabase.auth.getUser();




if(!user){

setLoading(false);

return;

}





const {
data

}=await supabase

.from("profiles")

.select("balance")

.eq(
"id",
user.id
)

.single();




setBalance(

Number(data?.balance || 0)

);



setLoading(false);


}







const packages=[

{
amount:5,
label:"Seed Pack",
icon:"🌱",
description:"Begin your journey"
},

{
amount:10,
label:"Forest Pack",
icon:"🌿",
description:"Grow your discoveries"
},

{
amount:25,
label:"Ancient Grove",
icon:"🌳",
description:"For dedicated trainers"
},

{
amount:50,
label:"Legendary Energy",
icon:"✨",
description:"Awaken rare discoveries"
}

];






if(loading){

return (

<div className="
min-h-screen
bg-[#020617]
flex
items-center
justify-center
text-emerald-100
font-black
text-xl
">

🌱 Awakening wallet...

</div>

);

}






return (

<main

className="

relative

min-h-screen

overflow-hidden

bg-gradient-to-br

from-[#020617]

via-[#052e16]

to-[#064e3b]

p-4

pb-32

md:p-8

text-white

"

>


<ForestBackground />




<div className="
relative
z-10
max-w-6xl
mx-auto
">


<AdminNav />







<section

className="

mt-10

rounded-[4rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

shadow-[0_30px_100px_rgba(16,185,129,.3)]

p-10

text-center

overflow-hidden

relative

"

>


<div className="
absolute
inset-0
bg-gradient-to-br
from-white/10
via-transparent
to-emerald-400/10
"/>



<div className="
relative
z-10
">


<div

className="

mx-auto

w-36

h-36

rounded-full

bg-emerald-400/20

border

border-white/20

flex

items-center

justify-center

shadow-[0_0_80px_rgba(52,211,153,.5)]

"

>


<img

src="/ancient-pulls/celestial-cat.png"

className="
w-28
drop-shadow-2xl
"

/>


</div>





<h1 className="
mt-8
text-5xl
font-black
">

ancientpulls Treasury

</h1>



<p className="
mt-3
text-xl
font-semibold
text-emerald-100
">

Your energy crystals fuel discoveries 🌿

</p>




<div

className="

mt-10

rounded-[3rem]

bg-gradient-to-br

from-emerald-400/30

to-emerald-950/50

border

border-emerald-200/30

backdrop-blur-xl

p-10

shadow-[0_0_80px_rgba(52,211,153,.35)]

"

>


<p className="
text-emerald-100
font-bold
uppercase
tracking-widest
">

Forest Energy

</p>



<h2 className="
mt-3
text-7xl
font-black
">

£{balance.toFixed(2)}

</h2>


</div>


</div>



</section>









<section className="

mt-10

grid

md:grid-cols-2

gap-6

">


{

packages.map(pack=>(


<div

key={pack.amount}

className="

rounded-[3rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

p-8

shadow-[0_20px_70px_rgba(16,185,129,.2)]

hover:-translate-y-3

transition

"

>


<div className="text-6xl">

{pack.icon}

</div>




<h2 className="
mt-5
text-3xl
font-black
">

{pack.label}

</h2>



<p className="
mt-2
text-emerald-100
font-semibold
">

{pack.description}

</p>



<div className="
mt-6
rounded-3xl
bg-emerald-400/20
border
border-emerald-200/30
p-5
text-center
">


<p className="
text-4xl
font-black
">

£{pack.amount}

</p>


</div>





<button

className="

mt-6

w-full

rounded-full

py-4

font-black

bg-emerald-400/30

border

border-emerald-200/40

shadow-[0_0_40px_rgba(52,211,153,.4)]

hover:bg-emerald-400/50

transition

"

>

💎 Recharge Crystal

</button>



</div>


))

}


</section>









<section

className="

mt-10

rounded-[3rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

p-8

"

>


<h2 className="
text-3xl
font-black
">

🎴 Discovery Rules

</h2>



<div className="
mt-6
space-y-3
text-emerald-100
font-bold
text-lg
">


<p>
🌱 First discovery: £1
</p>

<p>
🌿 Second discovery: £2
</p>

<p>
🌳 Third discovery: £3
</p>

<p>
🌙 Maximum 10 discoveries per day
</p>


</div>


</section>





</div>


</main>

);

}
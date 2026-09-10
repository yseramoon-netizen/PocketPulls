"use client";

interface PullPricingProps {
  pullCount:number;
}


export default function PullPricing({
  pullCount
}:PullPricingProps){


const DAILY_LIMIT = 10;

const nextPrice = pullCount + 1;

const remaining = DAILY_LIMIT - pullCount;


return(

<section

className="
mt-10
rounded-[3rem]
bg-white/10
backdrop-blur-2xl
border
border-white/20
p-8
shadow-[0_0_60px_rgba(16,185,129,.2)]
"

>


<div className="text-center">


<h2 className="
text-3xl
font-black
">

🌲 Forest Pricing

</h2>


<p className="
mt-2
text-emerald-200
font-bold
">

The more you explore, the deeper the forest grows

</p>


</div>





<div className="
mt-8
grid
md:grid-cols-3
gap-5
">


<div className="
rounded-3xl
bg-black/30
p-6
text-center
">

<p className="
text-emerald-200
font-bold
">

Today's Pulls

</p>


<p className="
text-5xl
font-black
mt-2
">

{pullCount}/{DAILY_LIMIT}

</p>


</div>





<div className="
rounded-3xl
bg-black/30
p-6
text-center
">

<p className="
text-emerald-200
font-bold
">

Next Discovery

</p>


<p className="
text-5xl
font-black
mt-2
text-yellow-300
">

£{nextPrice}

</p>


</div>






<div className="
rounded-3xl
bg-black/30
p-6
text-center
">

<p className="
text-emerald-200
font-bold
">

Remaining

</p>


<p className="
text-5xl
font-black
mt-2
">

{remaining}

</p>


</div>



</div>






<div className="
mt-8
rounded-3xl
bg-gradient-to-r
from-yellow-400/20
to-emerald-400/20
p-5
text-center
">


<p className="
font-black
">

🎴 Every discovery costs £1 more than the previous one

</p>


<p className="
mt-2
text-emerald-200
">

Your forest resets every day 🌙

</p>


</div>




</section>


);


}
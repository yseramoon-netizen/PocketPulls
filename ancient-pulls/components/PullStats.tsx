"use client";


interface PullStatsProps {

  cost:number;

  totalValue:number;

  bestPull:{
    name:string;
    value:number;
  };

  count:number;

}



export default function PullStats({

  cost,

  totalValue,

  bestPull,

  count

}:PullStatsProps){



const profit =
totalValue - cost;



const returnRate =
cost > 0

?

((totalValue / cost) * 100)

:

0;





const stats=[


{
label:"Cards Pulled",
value:count,
icon:"🎴"
},


{
label:"Spent",
value:`£${cost.toFixed(2)}`,
icon:"💰"
},


{
label:"Forest Value",
value:`£${totalValue.toFixed(2)}`,
icon:"💎"
},


{
label:"Best Discovery",
value:bestPull.name,
icon:"👑"
}


];








return(


<section

className="

mt-10

grid

grid-cols-2

md:grid-cols-4

gap-5

"

>


{


stats.map((stat)=>(


<div

key={stat.label}

className="

relative

overflow-hidden

rounded-[2rem]

bg-white/10

backdrop-blur-2xl

border

border-white/20

p-6

shadow-[0_0_40px_rgba(16,185,129,.15)]

hover:scale-[1.03]

transition

"

>


<div

className="

absolute

inset-0

bg-gradient-to-br

from-white/10

to-transparent

pointer-events-none

"

/>






<div

className="

relative

text-center

"

>


<div

className="

text-4xl

"

>

{stat.icon}

</div>





<p

className="

mt-3

text-emerald-200

uppercase

tracking-widest

text-xs

font-black

"

>

{stat.label}

</p>





<p

className="

mt-2

text-xl

font-black

truncate

"

>

{stat.value}

</p>




</div>



</div>



))

}





<div

className="

col-span-2

md:col-span-4

rounded-[2rem]

bg-black/20

backdrop-blur-xl

border

border-white/10

p-6

flex

justify-between

items-center

"

>


<div>


<p

className="

text-emerald-200

text-sm

font-bold

uppercase

"

>

Collector Return

</p>



<p

className={`

text-4xl

font-black

mt-1

${
profit >= 0

?

"text-yellow-300"

:

"text-red-400"

}

`}

>

{

profit >= 0

?

"+"

:

""

}

£{profit.toFixed(2)}

</p>


</div>






<div className="text-right">


<p

className="

text-emerald-200

text-sm

font-bold

"

>

Value Efficiency

</p>


<p

className="

text-3xl

font-black

"

>

{returnRate.toFixed(0)}%

</p>


</div>





</div>





</section>


);


}
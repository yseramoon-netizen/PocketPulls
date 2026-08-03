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



const stats=[

{
label:"Total Pulls",
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
grid

grid-cols-2

md:grid-cols-4

gap-5

mt-10

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

text-center

shadow-[0_0_40px_rgba(16,185,129,.15)]

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

text-sm

font-bold

uppercase

tracking-wider

"

>

{stat.label}

</p>




<p

className="

mt-2

text-xl

font-black

"

>

{stat.value}

</p>



</div>


))

}



</section>

);


}
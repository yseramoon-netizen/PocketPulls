"use client";


interface PullStatsProps {

history:any[];

}



export default function PullStats({

history

}:PullStatsProps){



const totalPulls = history.length;



const totalValue = history.reduce(

(sum,pull)=>

sum + Number(
pull.market_value || 0
),

0

);



const bestPull = history.length

?

Math.max(

...history.map(

p=>Number(
p.market_value || 0
)

)

)

:

0;



const average = totalPulls

?

totalValue / totalPulls

:

0;





const stats=[


{
label:"Discoveries",
value:totalPulls,
icon:"🎴",
glow:"from-purple-400/30"
},


{
label:"Forest Value",
value:`£${totalValue.toFixed(2)}`,
icon:"💎",
glow:"from-emerald-400/30"
},


{
label:"Crown Pull",
value:`£${bestPull.toFixed(2)}`,
icon:"👑",
glow:"from-yellow-400/30"
},


{
label:"Average Find",
value:`£${average.toFixed(2)}`,
icon:"✨",
glow:"from-blue-400/30"
}


];







return(


<section

className="
relative
mt-10

overflow-hidden

rounded-[3rem]

p-8

bg-white/10

backdrop-blur-2xl

border
border-white/20

shadow-[0_30px_100px_rgba(0,0,0,.35)]

"

>



{/* background energy */}

<div className="
absolute
-top-20
right-0
w-72
h-72
bg-emerald-400/20
rounded-full
blur-3xl
"/>


<div className="
absolute
bottom-0
left-0
w-64
h-64
bg-purple-500/20
rounded-full
blur-3xl
"/>








<div className="
relative
z-10
flex
items-center
gap-4
mb-8
">


<div className="
w-16
h-16
rounded-3xl
bg-gradient-to-br
from-yellow-300
to-emerald-500
flex
items-center
justify-center
text-3xl
shadow-[0_0_40px_rgba(250,204,21,.5)]
">

🌿

</div>





<div>

<h2 className="
text-3xl
font-black
text-white
">

Collector Profile

</h2>


<p className="
text-white/50
font-bold
">

Your PocketPulls journey

</p>


</div>


</div>









<div className="
relative
z-10

grid
grid-cols-2
md:grid-cols-4

gap-4

"

>



{

stats.map(stat=>(



<div

key={stat.label}

className="
relative
overflow-hidden

rounded-[2rem]

p-5

bg-white/10

border
border-white/10

backdrop-blur-xl

hover:bg-white/20

transition

"

>


<div className={`

absolute
inset-0
bg-gradient-to-br
${stat.glow}

blur-2xl

`}

/>





<div className="
relative
z-10
">


<div className="
text-3xl
mb-3
">

{stat.icon}

</div>



<p className="
text-white/50
text-xs
uppercase
tracking-widest
font-black
">

{stat.label}

</p>




<p className="
mt-2
text-2xl
font-black
text-white
">

{stat.value}

</p>


</div>



</div>


))


}



</div>






</section>


);


}
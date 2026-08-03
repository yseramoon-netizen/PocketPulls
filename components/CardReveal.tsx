"use client";

type Props = {
  card:any;
};


export default function CardReveal({
  card
}:Props){


if(!card)
return null;



function rarityGlow(rarity:string){

const r = rarity?.toLowerCase() || "";


if(r.includes("secret"))
return "shadow-[0_0_100px_rgba(168,85,247,.9)]";


if(r.includes("illustration"))
return "shadow-[0_0_100px_rgba(236,72,153,.9)]";


if(r.includes("ultra"))
return "shadow-[0_0_100px_rgba(250,204,21,.9)]";


if(r.includes("rare"))
return "shadow-[0_0_80px_rgba(250,204,21,.7)]";


return "shadow-[0_0_60px_rgba(52,211,153,.6)]";

}




return (

<section

className="

relative

overflow-hidden

rounded-[4rem]

bg-white/10

backdrop-blur-3xl

border

border-white/20

shadow-[0_30px_100px_rgba(16,185,129,.35)]

p-10

text-center

animate-in

fade-in

duration-700

"

>


{/* magical particles */}

{

Array.from({length:20}).map((_,i)=>(

<div

key={i}

className="

absolute

w-2

h-2

rounded-full

bg-yellow-300

shadow-[0_0_25px_10px_rgba(250,204,21,.8)]

animate-pulse

"

style={{

left:`${Math.random()*100}%`,

top:`${Math.random()*100}%`

}}

/>

))

}





<div className="relative z-10">



<p

className="

text-emerald-200

font-black

uppercase

tracking-widest

"

>

✨ Discovery Complete ✨

</p>






<div

className={`

mt-8

mx-auto

w-fit

rounded-[2.5rem]

p-5

bg-black/20

border

border-white/20

${rarityGlow(card.rarity)}

animate-bounce

`

}

>


<img

src={card.image_url}

className="

w-72

rounded-3xl

shadow-2xl

"

/>


</div>







<h1

className="

mt-8

text-5xl

font-black

text-white

"

>

{card.name}

</h1>






<div

className="

mt-5

inline-block

rounded-full

px-6

py-3

bg-white/10

border

border-white/20

text-emerald-100

font-black

"

>

{card.rarity}

</div>







<div

className="

mt-8

grid

md:grid-cols-2

gap-5

"

>


<div

className="

rounded-3xl

bg-white/10

border

border-white/20

p-6

"

>

<p className="text-emerald-200 font-bold">

Market Value

</p>


<p

className="

text-4xl

font-black

text-yellow-300

"

>

£{Number(card.market_value || 0).toFixed(2)}

</p>


</div>







<div

className="

rounded-3xl

bg-emerald-400/20

border

border-emerald-200/30

p-6

"

>

<p className="text-emerald-100 font-bold">

Added To

</p>


<p

className="

text-3xl

font-black

text-white

"

>

Forest Log 🌿

</p>


</div>



</div>






<button

onClick={()=>window.scrollTo({
top:0,
behavior:"smooth"
})}

className="

mt-10

rounded-full

px-10

py-4

bg-emerald-400/30

border

border-emerald-200/30

text-white

font-black

hover:bg-emerald-400/50

transition

"

>

Continue Exploring 🌱

</button>






</div>


</section>

);


}
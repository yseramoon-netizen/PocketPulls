"use client";


interface PullHistoryProps {

history:any[];

}



export default function PullHistory({

history

}:PullHistoryProps){



const visibleHistory = history.slice(0,5);



return(


<section

className="
mt-12
relative
overflow-hidden
rounded-[3rem]
p-8

bg-white/10
backdrop-blur-2xl

border
border-white/20

shadow-[0_30px_80px_rgba(0,0,0,.25)]

"

>


{/* ambient glow */}

<div className="
absolute
top-0
right-0
w-64
h-64
bg-emerald-400/20
rounded-full
blur-3xl
"
/>


<div className="
absolute
bottom-0
left-0
w-52
h-52
bg-yellow-300/10
rounded-full
blur-3xl
"
/>






<div className="
relative
z-10
flex
justify-between
items-center
"

>


<h2 className="
text-3xl
font-black
text-white
tracking-tight
">

Recent Pulls

</h2>



<span className="
text-emerald-200
font-bold
text-sm
bg-white/10
px-4
py-2
rounded-full
backdrop-blur-xl
">

{history.length} discovered

</span>


</div>







<div className="
relative
z-10
mt-8
space-y-3
"

>


{


visibleHistory.length === 0

?

<div className="
text-center
py-12
text-white/50
font-bold
">

The forest is waiting 🌱

</div>


:


visibleHistory.map((pull:any,index)=>(



<div

key={index}

className={`

group

relative

flex
items-center
gap-5

rounded-[2rem]

p-4

overflow-hidden

transition-all
duration-500


bg-white/10

backdrop-blur-xl

border
border-white/10


hover:bg-white/20

hover:scale-[1.02]


${

index===4

?

"opacity-40 scale-[0.96]"

:

""

}

`

}

>


{/* shine */}

<div className="
absolute
inset-0
bg-gradient-to-r
from-white/10
via-transparent
to-transparent
opacity-0
group-hover:opacity-100
transition
"
/>






<img

src={pull.pokemon_cards.image_url}

className="
relative
z-10

w-20
h-20

object-cover

rounded-2xl

shadow-[0_10px_30px_rgba(0,0,0,.4)]

"

 />






<div className="
relative
z-10
flex-1
">


<p className="
text-white
font-black
text-lg
">

{pull.pokemon_cards.name}

</p>




<p className="
text-white/50
text-sm
font-bold
">

{pull.pokemon_cards.rarity}

</p>


</div>






<div className="
relative
z-10
text-right
">


<p className="
font-black
text-xl
text-yellow-300
drop-shadow
">

£{Number(
pull.market_value
).toFixed(2)}

</p>



<p className="
text-white/40
text-xs
mt-1
">

{new Date(
pull.created_at
).toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})}

</p>


</div>





</div>



))


}





</div>






{/* bottom fade */}

<div className="
absolute
bottom-0
left-0
right-0
h-28

bg-gradient-to-t
from-[#052e16]
to-transparent

pointer-events-none

"

/>





</section>


);


}
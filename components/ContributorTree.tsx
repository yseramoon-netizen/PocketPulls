"use client";


export default function ContributorTree({
  visitors
}:{
  visitors:any[]
}){


const lukas = visitors
.filter(
(v)=>
v.profiles?.name
?.toLowerCase()
.includes("lukas")
)
.reduce(
(total,v)=>
total + Number(v.quantity || 0),
0
);



const skye = visitors
.filter(
(v)=>
v.profiles?.name
?.toLowerCase()
.includes("skye")
)
.reduce(
(total,v)=>
total + Number(v.quantity || 0),
0
);




const total = lukas + skye;


const lukasPercent =
total
?
Math.round((lukas / total)*100)
:
0;


const skyePercent =
total
?
Math.round((skye / total)*100)
:
0;



return (

<section

className="

mt-12

rounded-[3rem]

bg-white/70

backdrop-blur-xl

border

border-green-100

shadow-xl

p-8

"

>


<h2

className="

text-3xl

font-black

text-center

text-emerald-950

"

>

🌳 The Garden Keepers

</h2>



<p

className="

text-center

text-emerald-700

mt-2

"

>

The forest grown by its caretakers

</p>






<div

className="

grid

md:grid-cols-2

gap-8

mt-8

"

>




{/* Lukas */}

<div

className="

rounded-3xl

bg-gradient-to-br

from-emerald-50

to-green-100

p-6

"

>


<div className="text-5xl">

🌙

</div>


<h3

className="

text-2xl

font-bold

mt-3

"

>

Lukas' Tree

</h3>



<p className="mt-2 text-gray-600">

{lukas.toLocaleString()} visitors planted

</p>



<div

className="

mt-5

h-5

bg-white

rounded-full

overflow-hidden

"

>

<div

className="

h-full

bg-emerald-400

rounded-full

transition-all

duration-700

"

style={{

width:`${lukasPercent}%`

}}

/>


</div>



<p className="mt-2 font-bold text-emerald-700">

{lukasPercent}% of the grove

</p>



</div>









{/* Skye */}

<div

className="

rounded-3xl

bg-gradient-to-br

from-pink-50

to-purple-100

p-6

"

>


<div className="text-5xl">

🌸

</div>



<h3

className="

text-2xl

font-bold

mt-3

"

>

Skye's Tree

</h3>




<p className="mt-2 text-gray-600">

{skye.toLocaleString()} visitors planted

</p>




<div

className="

mt-5

h-5

bg-white

rounded-full

overflow-hidden

"

>


<div

className="

h-full

bg-pink-300

rounded-full

transition-all

duration-700

"

style={{

width:`${skyePercent}%`

}}

/>


</div>



<p className="mt-2 font-bold text-pink-600">

{skyePercent}% of the grove

</p>



</div>





</div>





</section>

);


}
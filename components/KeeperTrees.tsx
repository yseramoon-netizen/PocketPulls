"use client";


type Props = {

lukas:number;

skye:number;

};



export default function KeeperTrees({

lukas,

skye

}:Props){





function treeStage(amount:number){


if(amount < 50)

return {

tree:"🌱",

title:"Seedling"

};


if(amount < 250)

return {

tree:"🌿",

title:"Young Grove"

};


if(amount < 750)

return {

tree:"🌳",

title:"Ancient Tree"

};


return {

tree:"🌲✨",

title:"Guardian Tree"

};


}






const lukasTree=treeStage(lukas);

const skyeTree=treeStage(skye);






return (

<section

className="

mt-10

rounded-[3rem]

bg-white/70

backdrop-blur-xl

border

border-white

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

🌳 Forest Keepers

</h2>





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

rounded-[2.5rem]

bg-gradient-to-br

from-emerald-50

to-green-200

p-8

text-center

shadow-lg

"

>


<div className="

text-8xl

animate-pulse

">

{lukasTree.tree}

</div>



<h3

className="

text-3xl

font-black

text-emerald-950

"

>

🌙 Lukas' Grove

</h3>



<p className="mt-2 font-bold text-emerald-700">

{lukasTree.title}

</p>



<div className="

mt-5

bg-white/70

rounded-full

py-3

"

>

🌿

{lukas.toLocaleString()}

cards planted

</div>


</div>









{/* Skye */}


<div

className="

rounded-[2.5rem]

bg-gradient-to-br

from-pink-50

to-purple-200

p-8

text-center

shadow-lg

"

>


<div className="

text-8xl

animate-pulse

">

{skyeTree.tree}

</div>



<h3

className="

text-3xl

font-black

text-purple-950

"

>

🌸 Skye's Grove

</h3>



<p className="mt-2 font-bold text-purple-700">

{skyeTree.title}

</p>



<div

className="

mt-5

bg-white/70

rounded-full

py-3

"

>

🌸

{skye.toLocaleString()}

cards planted

</div>


</div>





</div>





</section>

);

}
/** Active scene time excludes hidden tabs and pauses. All animation uses this one clock. */
export class OrbitClock {
 time=0;
 private last:number|null=null;
 sample(stamp:number,running:boolean){
  if(this.last!==null&&running)this.time+=Math.max(0,Math.min(100,stamp-this.last));
  this.last=stamp;return this.time;
 }
 suspend(){this.last=null}
}

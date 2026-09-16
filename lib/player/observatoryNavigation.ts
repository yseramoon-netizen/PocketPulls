export type ObservatorySearch=Record<string,string|string[]|undefined>;
/** Preserve arrival IDs, card links and history when retiring the old routes. */
export function observatoryHref(search:ObservatorySearch,universe=false):string {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(search)){
    if(Array.isArray(value))for(const item of value)params.append(key,item);
    else if(value!==undefined)params.set(key,value);
  }
  if(universe&&!params.has('arrive')&&!params.has('card'))params.set('view','universe');
  const query=params.toString();return '/observatory'+(query?'?'+query:'');
}

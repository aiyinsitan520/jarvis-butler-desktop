import {useEffect,useRef} from 'react'

/** Page-local pointer feedback. No idle RAF loop, global cursor hooks or React renders. */
export function useGaze(){
 const ref=useRef<HTMLButtonElement>(null)
 useEffect(()=>{
  const button=ref.current
  if(!button)return
  const root=document.documentElement
  const reduced=matchMedia('(prefers-reduced-motion: reduce)')
  let frame=0,point={x:0,y:0}
  const disabled=()=>root.dataset.motion==='reduce'||reduced.matches||document.hidden
  const write=(x:number,y:number)=>{button.style.setProperty('--gaze-x',`${x.toFixed(3)}px`);button.style.setProperty('--gaze-y',`${y.toFixed(3)}px`)}
  const reset=()=>{if(frame)cancelAnimationFrame(frame);frame=0;write(0,0)}
  const update=()=>{
   frame=0
   if(disabled()){reset();return}
   const rect=button.getBoundingClientRect()
   if(!rect.width||!rect.height){reset();return}
   // Saturate gently near the face; the eyes always remain inside the 34px icon.
   write(Math.tanh((point.x-rect.left-rect.width/2)/90)*3,Math.tanh((point.y-rect.top-rect.height/2)/90)*2.5)
  }
  const move=(event:PointerEvent)=>{
   if(disabled()||event.pointerType==='touch'){reset();return}
   point={x:event.clientX,y:event.clientY}
   if(!frame)frame=requestAnimationFrame(update)
  }
  const visibility=()=>{if(document.hidden)reset()}
  const preference=()=>reset()
  const observer=new MutationObserver(preference)
  observer.observe(root,{attributes:true,attributeFilter:['data-motion']})
  document.addEventListener('pointermove',move,{passive:true})
  document.addEventListener('pointerleave',reset)
  document.addEventListener('pointercancel',reset)
  document.addEventListener('visibilitychange',visibility)
  window.addEventListener('blur',reset)
  window.addEventListener('resize',reset)
  reduced.addEventListener('change',preference)
  return()=>{
   reset();observer.disconnect()
   document.removeEventListener('pointermove',move)
   document.removeEventListener('pointerleave',reset)
   document.removeEventListener('pointercancel',reset)
   document.removeEventListener('visibilitychange',visibility)
   window.removeEventListener('blur',reset)
   window.removeEventListener('resize',reset)
   reduced.removeEventListener('change',preference)
  }
 },[])
 return ref
}

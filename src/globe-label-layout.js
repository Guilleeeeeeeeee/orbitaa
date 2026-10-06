// Labels stay close to their geographic anchors. Crowded labels wait for zoom.
export function layoutGlobeLabels(anchors,width,height) {
  const occupied=[];
  return anchors.map(a=>{
    const candidates=[[0,-a.height/2-12],[0,a.height/2+12],[-a.width/2-12,0],[a.width/2+12,0],[0,-a.height/2-48],[0,a.height/2+48]];
    for(const [dx,dy] of candidates){
      const x=a.x+dx,y=a.y+dy,box={left:x-a.width/2,right:x+a.width/2,top:y-a.height/2,bottom:y+a.height/2};
      if(box.left<8||box.right>width-8||box.top<8||box.bottom>height-8)continue;
      if(occupied.some(b=>box.left<b.right+6&&box.right>b.left-6&&box.top<b.bottom+6&&box.bottom>b.top-6))continue;
      occupied.push(box);
      return {...a,visible:true,x,y,endX:Math.max(box.left,Math.min(box.right,a.x)),endY:Math.max(box.top,Math.min(box.bottom,a.y))};
    }
    return {...a,visible:false};
  });
}

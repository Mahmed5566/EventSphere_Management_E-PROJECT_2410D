// Small, reusable presentation components.
// This file keeps main.jsx readable and gives every page a consistent look.

import React, { useEffect, useState } from 'react';

export function Loader({full=false}){return <div className={full?'loader full':'loader'}>
  <div className="loader-wrapper">
    <div className="loader-orbit"></div>
    <div className="loader-ring"></div>
    <div className="loader-pulse"></div>
    <div className="loader-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
  <b>EVENTSPHERE</b>
  <small>Loading your command center...</small>
</div>}
export function Toast({text,onClose}){useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t)},[]);return <div className="toast"><i className="fa-solid fa-bolt"></i>{text}<button onClick={onClose}>×</button></div>}
export function Modal({title,children,onClose,wide=false}){return <div className="modal" role="dialog" aria-modal="true" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={'modal-card '+(wide?'wide':'')} onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span className="section-kicker">EDITOR</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><i className="fa-solid fa-xmark"></i></button></div>{children}</div></div>}
export function PageTitle({kicker,title,copy,action,icon}){
  return <div className={'page-title'+(icon?' has-emblem':'')}>
    {icon&&<span className="page-emblem" aria-hidden="true"><i className={'fa-solid '+icon}></i></span>}
    <div><div className="kicker">{kicker}</div><h1>{title}</h1><p>{copy}</p></div>
    {action&&<div>{action}</div>}
  </div>
}
export function Empty({text}){return <div className="empty"><i className="fa-regular fa-folder-open"></i><b>No records</b><span>{text}</span></div>}

// Skeleton placeholder block (see styles/design-system.css). Purely decorative.
export function Skeleton({className='',style}){
  return <span className={'ds-skel '+(className||'')} style={style} aria-hidden="true" />
}

// A panel-shaped loading skeleton: a title row plus a few text lines.
export function SkeletonPanel({rows=4,className=''}){
  return <div className={'panel ds-skel-panel '+(className||'')} aria-hidden="true">
    <span className="ds-skel ds-skel-title" />
    {Array.from({length:rows},(_,i)=><span key={i} className="ds-skel ds-skel-line" style={{width:`${94-(i*13)%46}%`}} />)}
  </div>
}

// An image that keeps a fixed ratio, lazy-loads, and degrades to an
// on-brand placeholder when the source is missing or fails to load.
export function SmartImage({
  src,alt='',ratio='16 / 9',className='',imgClassName='',
  loading='lazy',decoding='async',width,height,fallbackIcon='fa-image',...rest
}){
  const [failed,setFailed]=useState(!src);
  useEffect(()=>{setFailed(!src)},[src]);
  return <span className={'ds-media '+(className||'')} style={{aspectRatio:ratio}}>
    {failed
      ? <span className="ds-media-fallback" role="img" aria-label={alt||'Image unavailable'}><i className={'fa-solid '+fallbackIcon}></i></span>
      : <img src={src} alt={alt} loading={loading} decoding={decoding} width={width} height={height} className={imgClassName} onError={()=>setFailed(true)} {...rest} />}
  </span>
}

import React from 'react';
import { LANDPIN_LOGO_BASE64 } from '../../assets/logo_base64';

export default function PlotPinLogo({ className = "w-10 h-10", alt = "PlotPin Logo" }) {
  return (
    <img 
      src={LANDPIN_LOGO_BASE64} 
      alt={alt} 
      className={`${className} object-contain`}
      loading="eager"
      decoding="sync"
    />
  );
}

export { PlotPinLogo, PlotPinLogo as LandPinLogo };

import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X, Wand2, Crop as CropIcon } from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  const [filter, setFilter] = useState('none');
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height);
    setCrop(initialCrop);
  };

  const getCroppedImg = () => {
    if (!completedCrop || !imgRef.current) return;
    
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    if (filter !== 'none') {
      ctx.filter = filter;
    }

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    const base64Image = canvas.toDataURL('image/jpeg');
    onSave(base64Image);
  };

  const setAspectRatio = (ratio: number | undefined) => {
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    if (ratio) {
      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, ratio, width, height), width, height));
    } else {
      setCrop(undefined); // Free crop
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Wand2 className="text-indigo-600"/> Advanced Media Manager</h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-900 bg-white p-2 rounded-full shadow-sm"><X/></button>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          {/* Main Workspace */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-checkered">
            <style dangerouslySetInnerHTML={{__html: `
              .bg-checkered {
                background-color: #f1f5f9;
                background-image: linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%, #e2e8f0),
                                  linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%, #e2e8f0);
                background-size: 20px 20px;
                background-position: 0 0, 10px 10px;
              }
            `}} />
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              className="max-h-full max-w-full shadow-2xl"
            >
              <img 
                ref={imgRef}
                src={imageUrl} 
                onLoad={onImageLoad}
                style={{ filter: filter !== 'none' ? filter : undefined, maxHeight: '60vh' }}
                alt="Crop preview" 
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
          
          {/* Sidebar Tools */}
          <div className="w-full md:w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-8 overflow-y-auto">
            <div>
              <h4 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4"><CropIcon size={18}/> Rasio Potongan (Crop)</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAspectRatio(undefined)} className="py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Free</button>
                <button onClick={() => setAspectRatio(1)} className="py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">1:1 (IG Post)</button>
                <button onClick={() => setAspectRatio(4/5)} className="py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">4:5 (IG Portrait)</button>
                <button onClick={() => setAspectRatio(9/16)} className="py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">9:16 (Reels/TikTok)</button>
              </div>
            </div>

            <div>
              <h4 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Wand2 size={18}/> Filter Cepat</h4>
              <div className="space-y-2">
                <button onClick={() => setFilter('none')} className={`w-full py-2 px-4 text-left rounded-lg text-sm font-bold border transition ${filter === 'none' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Normal</button>
                <button onClick={() => setFilter('contrast(120%) saturate(110%)')} className={`w-full py-2 px-4 text-left rounded-lg text-sm font-bold border transition ${filter === 'contrast(120%) saturate(110%)' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Vibrant (Sosmed)</button>
                <button onClick={() => setFilter('grayscale(100%) contrast(120%)')} className={`w-full py-2 px-4 text-left rounded-lg text-sm font-bold border transition ${filter === 'grayscale(100%) contrast(120%)' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>B&W Cinematic</button>
                <button onClick={() => setFilter('sepia(80%) contrast(110%)')} className={`w-full py-2 px-4 text-left rounded-lg text-sm font-bold border transition ${filter === 'sepia(80%) contrast(110%)' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Vintage Warm</button>
              </div>
            </div>

            <div className="mt-auto">
              <button onClick={getCroppedImg} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition">
                <Check size={20}/> Terapkan Perubahan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

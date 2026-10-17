import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medianFilter, processImage } from './process.js';
const defaults = { brightness: 0, contrast: 0, median: 0, levels: 0, threshold: 128 };
test('grayscale preserves neutral values and outputs opaque pixels', () => {
  assert.deepEqual([...processImage(new Uint8ClampedArray([80,80,80,255]),1,1,defaults)], [80,80,80,255]);
});
test('transparent pixels are composited on white', () => {
  assert.deepEqual([...processImage(new Uint8ClampedArray([0,0,0,0]),1,1,defaults)], [255,255,255,255]);
});
test('two-value mode respects threshold', () => {
  const data = new Uint8ClampedArray([127,127,127,255,128,128,128,255]);
  const output = processImage(data,2,1,{...defaults, levels:2});
  assert.equal(output[0],0); assert.equal(output[4],255);
});
test('five-value mode uses five gray levels', () => {
  const pixels = new Uint8ClampedArray(256*4);
  for(let i=0;i<256;i++) pixels.set([i,i,i,255],i*4);
  const output = processImage(pixels,256,1,{...defaults,levels:5});
  assert.deepEqual([...new Set(Array.from({length:256},(_,i)=>output[i*4]))], [0,64,128,191,255]);
});
test('median removes isolated noise', () => {
  const pixels = new Uint8ClampedArray([0,0,0,0,255,0,0,0,0]);
  assert.equal(medianFilter(pixels,3,3,1)[4],0);
});
test('sliding histogram matches a simple reference at edges and large radii', () => {
  const width=7,height=5;
  const values=Uint8ClampedArray.from({length:width*height},(_,i)=>(i*79+17)%256);
  for(const radius of [1,2,6,12]) {
    const actual=medianFilter(values,width,height,radius);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const neighbors=[];
      for(let yy=Math.max(0,y-radius);yy<=Math.min(height-1,y+radius);yy++)
        for(let xx=Math.max(0,x-radius);xx<=Math.min(width-1,x+radius);xx++) neighbors.push(values[yy*width+xx]);
      neighbors.sort((a,b)=>a-b);
      assert.equal(actual[y*width+x],neighbors[Math.floor(neighbors.length/2)]);
    }
  }
});

#!/usr/bin/env python3
import re,sys
from pathlib import Path

def remove_portfolio(text):
 spans=[]
 for match in re.finditer(r'(?m)^\s*server\s*\{',text):
  start=match.start();i=text.index('{',start);depth=0;quote=None;comment=False
  while i<len(text):
   char=text[i]
   if comment:
    if char=='\n':comment=False
   elif quote:
    if char=='\\':i+=1
    elif char==quote:quote=None
   elif char=='#':comment=True
   elif char in ('"',"'"):quote=char
   elif char=='{':depth+=1
   elif char=='}':
    depth-=1
    if depth==0:
     names=[n for group in re.findall(r'(?m)^\s*server_name\s+([^;]+);',text[start:i+1]) for n in group.split()]
     if 'th.io.vn' in names:
      if names!=['th.io.vn']:raise ValueError('Mixed hostname block; manual review required')
      spans.append((start,i+1))
     break
   i+=1
  else:raise ValueError('Unterminated server block')
 if len(spans)>1:raise ValueError('Duplicate Portfolio blocks')
 for start,end in reversed(spans):text=text[:start]+text[end:]
 return text
if __name__=='__main__':
 source,target=map(Path,sys.argv[1:3]);target.write_text(remove_portfolio(source.read_text()))

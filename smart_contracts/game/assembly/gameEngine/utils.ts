export const mapStrToU8 = (data: string): StaticArray<u8> => {
  const newData = data.split(',');
  const ret = new StaticArray<u8>(newData.length);
  for (let i = 0; i < newData.length; i++) {
    ret[i] = U8.parseInt(newData.at(i));
  }
  return ret;
};

export const mapStrToBool = (val: string): boolean => {
  if (val.toLowerCase() === 'true') return true;
  return false;
};

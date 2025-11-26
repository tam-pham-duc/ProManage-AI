
export const sanitizeFirestoreData = (data: any): any => {
  if (data === null || data === undefined) return data;
  
  // Handle Firestore Timestamps
  if (data && typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  // Handle Firestore References (Circular)
  // DocumentReference objects contain a pointer to the Firestore instance which causes circular reference errors
  // We convert them to a simplified object or string representation
  if (data && typeof data === 'object' && data.firestore && typeof data.path === 'string') {
      return { 
          refPath: data.path,
          id: data.id 
      }; 
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeFirestoreData(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
};

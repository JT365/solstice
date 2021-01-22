    
    var slave = 0x0f;
    var slaveReadToken = "";
    var slaveWriteToken = "";
    var startToken = "S - Start";
    var stopToken = "P - Stop";
    var ACKToken = "ACK";
    var NACKToken = "NACK";
    var retToken = "\n\r";
       
// Main function of solstice
function processData(rawData) {
    var temp = slave<<1;
    slaveWriteToken = temp.toString(16);
    slaveWriteToken = slaveWriteToken.toUpperCase()+" Write";

    temp = temp | 0x1;
    slaveReadToken = temp.toString(16);
    slaveReadToken = slaveReadToken.toUpperCase()+" Read";

    var result = retrieveTransaction(rawData);
    if (result != null) { 
    		download("solstice.code", writePseudo(result));
//        writePseudo(result);
    }
}	

function retrieveTransaction(rawData) {
//    var arrTransaction = [{"timestamp":"0", "command":"R/W", "address":"0x8700", "data":[]}];
 var arrTransaction = [[]];
 
    for (var i=0; i<rawData.length; i++) {
    	// Dropoff any abnormal bits
    	if (rawData[i] == null || rawData[i].length < 4) {
    	    	console.log("retrieveTransaction() find an invalid record in raw data - %d", i);
    		continue;
    	}

         // Transaction should start with a Start bit
	if (rawData[i][3].indexOf(startToken) === -1) {
    	    	console.log("Not a Start bit, retrieveTransaction() dropoff a record in raw data - %d", i);
		continue;
	}
	// Increase to next bits	
	if (++i >= rawData.length) {
		return arrTransaction;
	}
    	// Dropoff any abnormal bits
    	if (rawData[i] == null || rawData[i].length < 4) {
    	    	console.log("retrieveTransaction() find an invalid record in raw data - %d", i);
    		continue;
    	} 

        // And then come with a slave address
        if (rawData[i][3] !== slaveWriteToken) {
    	    console.log("Not a slave address, retrieveTransaction() dropoff a record in raw data - %d", i);
            continue;	
        }

        let temp = new Array();
 
        // Record all bit stream to a new arrary before meet a Stop bit
        temp.push(rawData[i]);  
 
        while (++i < rawData.length) {

	    if (rawData[i] == null || rawData[i].length < 4) {
    	    	console.log("retrieveTransaction() find an invalid record in raw data - %d", i);
	    	continue;
    	    }      	
  
            if (rawData[i][3].indexOf(stopToken) !== -1 ) {
                break;
            }

            temp.push(rawData[i]);  
        }  

        // Reverse this new array in a 'readable' convension      
        var result = reverseTransaction(temp);
        if (result != null) {
            arrTransaction.push(result);
        }

    }

    return (arrTransaction);
}

function reverseTransaction(transData) {
    let temp = new Array();
    let temp1,temp2;
 
    	    temp1 = retrieveAddress(transData);
    	    if (temp1 != null) {
    	        temp2 = retrieveRW(transData);
 
    	        // Retrieve read data
   	        if (temp2 != null) {
   	            	// Record timestamp
    		        temp.push(transData[0][0]);

     		        // Record command type
    		        temp.push("R");

    		        // Record register address
     		        temp.push(temp1);

    		        // Record data stream
    		        temp.push(temp2);
    	         }
    	         // Retrieve write data
    	         else {
    	             temp2 = retrieveData(transData, 6); 
    	             if (temp2 != null && temp2.length>0) {
  	            	// Record timestamp
    		        temp.push(transData[0][0]);

     		        // Record command type
    		        temp.push("W");

    		        // Record register address
     		        temp.push(temp1);
     		        
    		        // Record data stream
    		        temp.push(temp2);
    	             }  
    	             else {

    	    	        console.log("retrieveData() find an invalid write cycle!");
 
 	            	// Record timestamp
    		        temp.push(transData[0][0]);

     		        // Record command type
    		        temp.push("I");

    		        // Record register address
     		        temp.push("temp1");
     		        
                  	temp.push(transData);
             	
    	             }	
    	         }
    	    }
    	    else {

 	            	// Record timestamp
    		        temp.push(transData[0][0]);

     		        // Record command type
    		        temp.push("I");

    		        // Record register address
     		        temp.push("");    		        

                  	temp.push(transData);
    	    }

    return (temp);
}

// Do arrary comparing
function compareArray(arr1, arr2) {
	if (arr1.length !== arr2.length)
	return false;
	
	for (var i=0; i<arr1.length; i++) {
		if (arr1[i] !== arr2[i]) 
		return false;
	
	}
	return true;
} 

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

// Produce pseudo codes to a disk file     
function writePseudo(entry) {
	var last;
	var res="";
	var resText;
	var resCode;
	
    for (var i = 1; i < entry.length; i++)  {
    	if (entry[i].length < 4)
    	continue;
    	
    	if (entry[i][1]==="I") {
    	    console.log("Invalid/Partial transaction found!");
             resText = retToken;

             for (var k=0; k<entry[i][3].length; k++) {
             	resText = resText+"// "+entry[i][3][k]+retToken;
             }

             console.log("%s", resText);
             res = res+resText;
             last = null;		
    	}
         else {
             if (last != null) {
             	if (last[1]===entry[i][1] && last[2]===entry[i][2] && compareArray(last[3],entry[i][3])) {
             		if (entry[i][1]==="R")
             		    continue;
             	}
            }

             resText = retToken+"// "+entry[i][0]+"S-"+entry[i][1]+"-0x"+entry[i][2]+":";
             for (var k=0; k<entry[i][3].length; k++) {
             	resText = resText+" 0x"+entry[i][3][k]+",";
            }
            resText = resText+retToken;
//             console.log("%s", resText);
            res = res+resText;
 
            resCode = "";
            if (entry[i][1]==="R") {
              	if (entry[i][3].length===1)
              	    resCode = "dataArray=readByte(0x"+entry[i][2]+");"+retToken;
              	else if (entry[i][3].length===2)
              	    resCode = "dataArray=readWord(0x"+entry[i][2]+");"+retToken;
              	else 
                    resCode = "dataArray=readArray(0x"+entry[i][2]+", "+entry[i][3].length+");"+retToken;
            } 
            else {
             	if (entry[i][3].length===1)
              	    resCode = "writeByte(0x"+entry[i][2]+", 0x"+entry[i][3][0]+");"+retToken;
              	else if (entry[i][3].length===2)
              	    resCode = "writeWord(0x"+entry[i][2]+", 0x"+entry[i][3][1]+entry[i][3][0]+");"+retToken;
               	else if (entry[i][3].length===4)
              	    resCode = "writeLong(0x"+entry[i][2]+", 0x"+entry[i][3][3]+entry[i][3][2]+entry[i][3][1]+entry[i][3][0]+");"+retToken;
              	else {
            	    resCode = "BYTE dataArray[]={";
                    for (var k=0; k<entry[i][3].length; k++) {
             	        resCode = resCode+" 0x"+entry[i][3][k]+",";
                    }           
                    resCode = resCode + "};"+retToken; 	
            	    resCode = resCode+"writeArray(0x"+entry[i][2]+", dataArray, "+entry[i][3].length+");"+retToken;
                }
            }

//             console.log("%s", resCode); 
             res = res+resCode;           
             last = entry[i];
         }
    }
    
    return res;
}

function retrieveAddress(entry) {
   if (entry.length < 6) 
       return;

    for (var i=0; i<entry.length; i++) {
    	if (entry[i].length<4)
    	    return;
    }    
  
    if (entry[0][3] === slaveWriteToken && entry[1][3] === ACKToken && entry[3][3] === ACKToken && entry[5][3] === ACKToken ) {
        return (entry[2][3] + entry[4][3]);
    }
    else {
    	console.log("invalid address cycle found!");
    }

}

function retrieveRW(entry) {

    for (var i=6; i<entry.length; i++) {

         // Transaction should start with a Start bit
	if (entry[i][3].indexOf(startToken) === -1) {
		continue;
	}

         if (++i >= entry.length)
             break;
             	
        // And then come with a slave address
        if (entry[i] [3] !== slaveReadToken) {
            continue;	
        }
        
        // Record all bits to a new arrary before meet a Stop bit
        return (retrieveData(entry, i+2));
        
    }     

}

function retrieveData(entry, ind) {
    let temp = [];
    let temp1;
	
    for (var i = ind; i < entry.length; i++)  {
        temp1=entry[i][3];

        if (++i>=entry.length)
            break;

        if (!(entry[i][3]  ===  ACKToken || entry[i][3]  ===  NACKToken))
            break;

        temp.push(temp1);
    }

    return (temp);
}

    
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
    const transactions = [];

    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];

        // 1. 寻找起始位 (Start Bit)
        if (!row || row.length < 4 || !row[3].includes(startToken)) {
            continue;
        }

        // 2. 检查紧随其后的从机地址位 (Slave Write)
        const nextRow = rawData[i + 1];
        if (!nextRow || nextRow.length < 4 || nextRow[3] !== slaveWriteToken) {
            console.warn(`Invalid sequence at ${i}: Start not followed by SlaveWrite`);
            continue;
        }

        // 3. 收集直到停止位 (Stop Bit) 之前的所有数据
        const transactionRows = [];
        let j = i + 1; // 从 Slave 地址位开始收集
        
        while (j < rawData.length) {
            const currentRow = rawData[j];
            if (currentRow && currentRow.length >= 4) {
                transactionRows.push(currentRow);
                // 遇到停止位，结束当前事务收集
                if (currentRow[3].includes(stopToken)) break;
            }
            j++;
        }

        // 4. 解析收集到的数据块
        if (transactionRows.length > 0) {
            const result = reverseTransaction(transactionRows);
            if (result) transactions.push(result);
        }

        // 将主循环索引跳到已处理事务的末尾
        i = j;
    }

    return transactions;
}

function reverseTransaction(transData) {
    const timestamp = transData[0][0];
    const addr = retrieveAddress(transData);

    // 1. 无效地址处理：提前返回
    if (addr == null) {
        return [timestamp, "I", "", transData];
    }

    // 2. 尝试读取 Read 数据
    let data = retrieveRW(transData);
    if (data != null) {
        return [timestamp, "R", addr, data];
    }

    // 3. 尝试读取 Write 数据
    data = retrieveData(transData, 6);
    if (data != null && data.length > 0) {
        return [timestamp, "W", addr, data];
    }

    // 4. 兜底逻辑：无效写入事务
    console.warn("retrieveData() found an invalid write cycle!");
    return [timestamp, "I", addr, transData];
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
    let last = null;
    let res = [];
    const NL = retToken; // 换行符

    for (let i = 1; i < entry.length; i++) {
        const row = entry[i];
        if (row.length < 4) continue;

        const [time, type, addr, data] = row;

        // 1. 处理无效/部分事务
        if (type === "I") {
            console.log("Invalid/Partial transaction found!");
            res.push(NL, ...data.map(d => `// ${d}${NL}`));
            last = null;
            continue;
        }

        // 2. 重复性过滤 (仅针对 Read 类型)
        if (last && type === "R" && last[1] === type && last[2] === addr && compareArray(last[3], data)) {
            continue;
        }

        // 3. 生成注释行 (S-R-0xXX: 0xXX, 0xXX...)
        const dataHex = data.map(d => ` 0x${d}`).join(',');
        res.push(`${NL}// ${time}S-${type}-0x${addr}:${dataHex},${NL}`);

        // 4. 生成伪代码
        let code = "";
        const len = data.length;

        if (type === "R") {
            const func = { 1: "readByte", 2: "readWord" }[len] || "readArray";
            const params = len > 2 ? `0x${addr}, ${len}` : `0x${addr}`;
            code = `dataArray=${func}(${params});`;
        } else {
            // Write 类型处理
            if (len === 1) {
                code = `writeByte(0x${addr}, 0x${data[0]});`;
            } else if (len === 2) {
                code = `writeWord(0x${addr}, 0x${data[1]}${data[0]});`;
            } else if (len === 4) {
                const hexVal = [...data].reverse().join(''); // 小端序拼接
                code = `writeLong(0x${addr}, 0x${hexVal});`;
            } else {
                code = `BYTE dataArray[]={${dataHex}};${NL}writeArray(0x${addr}, dataArray, ${len});`;
            }
        }

        res.push(code + NL);
        last = row;
    }

    return res.join("");
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

    //
    for (let i = 6; i < entry.length - 1; i++) {
        
        // 1. 检查是否包含 Start Token
        const isStart = entry[i][3].includes(startToken);
        // 2. 检查紧随其后的是否是 Slave Read Token
        const isSlaveRead = entry[i + 1][3] === slaveReadToken;

        if (isStart && isSlaveRead) {
            // 找到匹配对，从 i+3 开始提取
            return retrieveData(entry, i + 3);
        }
    }
    //
    return [];

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



class Clone {

    constructor(sourceName, targetName, sourceChunk, targetChunk) {
        // Ensure both chunks are non-empty
        if (!sourceChunk || sourceChunk.length === 0) {
            throw new Error("sourceChunk is empty or undefined");
        }
        if (!targetChunk || targetChunk.length === 0) {
            throw new Error("targetChunk is empty or undefined");
        }
        this.sourceName = sourceName;
        this.sourceStart = sourceChunk[0].lineNumber;
        this.sourceEnd = sourceChunk[sourceChunk.length -1].lineNumber;
        this.sourceChunk = sourceChunk;

        this.targets = [{ name: targetName, startLine: targetChunk[0].lineNumber }];
    }

    equals(clone) {
        return this.sourceName == clone.sourceName &&
            this.sourceStart == clone.sourceStart &&
            this.sourceEnd == clone.sourceEnd;
    }

    addTarget(clone) {
        // Check if clone and its targets exist
        if (!clone || !clone.targets) {
            return; // Skip if clone or targets are missing
        }
        this.targets = this.targets.concat(clone.targets);
    }

    isNext(clone) {
        // Ensure both chunks have enough lines to compare
        if (this.sourceChunk.length < 1 || clone.sourceChunk.length < 2) {
            return false; // Cannot compare, so return false
        }

        return (this.sourceChunk[this.sourceChunk.length-1].lineNumber ==
                clone.sourceChunk[clone.sourceChunk.length-2].lineNumber);
    }

    maybeExpandWith(clone) {
        if (this.isNext(clone)) {
            this.sourceChunk = [...new Set([...this.sourceChunk, ...clone.sourceChunk])];
            this.sourceEnd = this.sourceChunk[this.sourceChunk.length-1].lineNumber;
            //console.log('Expanded clone, now starting at', this.sourceStart, 'and ending at', this.sourceEnd);
            return true;
        } else {
            return false;
        }
    }
}

module.exports = Clone;

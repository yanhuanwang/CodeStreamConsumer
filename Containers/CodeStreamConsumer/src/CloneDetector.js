const emptyLine = /^\s*$/;
const oneLineComment = /\/\/.*/;
const oneLineMultiLineComment = /\/\*.*?\*\//;
const openMultiLineComment = /\/\*+[^\*\/]*$/;
const closeMultiLineComment = /^[\*\/]*\*+\//;

const SourceLine = require('./SourceLine');
const FileStorage = require('./FileStorage');
const Clone = require('./Clone');

const DEFAULT_CHUNKSIZE = 5;

class CloneDetector {
    #myChunkSize = process.env.CHUNKSIZE || DEFAULT_CHUNKSIZE;
    #myFileStore = FileStorage.getInstance();

    constructor() {}

    // Private Methods
    // --------------------
    #filterLines(file) {
        let lines = file.contents.split('\n');
        let inMultiLineComment = false;
        file.lines = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (inMultiLineComment) {
                if (-1 != line.search(closeMultiLineComment)) {
                    line = line.replace(closeMultiLineComment, '');
                    inMultiLineComment = false;
                } else {
                    line = '';
                }
            }

            line = line.replace(emptyLine, '');
            line = line.replace(oneLineComment, '');
            line = line.replace(oneLineMultiLineComment, '');

            if (-1 != line.search(openMultiLineComment)) {
                line = line.replace(openMultiLineComment, '');
                inMultiLineComment = true;
            }

            file.lines.push(new SourceLine(i + 1, line.trim()));
        }

        return file;
    }

    #getContentLines(file) {
        return file.lines.filter(line => line.hasContent());
    }

    #chunkify(file) {
        let chunkSize = this.#myChunkSize;
        let lines = this.#getContentLines(file);
        file.chunks = [];

        for (let i = 0; i <= lines.length - chunkSize; i++) {
            let chunk = lines.slice(i, i + chunkSize);
            file.chunks.push(chunk);
        }
        return file;
    }

    #chunkMatch(first, second) {
        if (first.length !== second.length) return false;

        for (let idx = 0; idx < first.length; idx++) {
            if (!first[idx].equals(second[idx])) {
                return false;
            }
        }
        return true;
    }

    #filterCloneCandidates(file, compareFile) {
        file.instances = file.instances || [];
        let newInstances = [];

        file.chunks.forEach((chunk1) => {
            compareFile.chunks.forEach((chunk2) => {
                // Ensure chunk1 and chunk2 are not empty
                if (chunk1.length === 0 || chunk2.length === 0) {
                    return;
                }

                if (this.#chunkMatch(chunk1, chunk2)) {
                    // Only instantiate Clone if chunks are valid
                    let clone = new Clone(file.name, compareFile.name, chunk1, chunk2);

                    // First file target
                    let startLine1 = chunk1[0].lineNumber;
                    let endLine1 = chunk1[chunk1.length - 1].lineNumber;

                    // Second file target
                    let startLine2 = chunk2[0].lineNumber;
                    let endLine2 = chunk2[chunk2.length - 1].lineNumber;

                    clone.addTarget({
                        fileName: file.name,
                        startLine: startLine1,
                        endLine: endLine1
                    });
                    clone.addTarget({
                        fileName: compareFile.name,
                        startLine: startLine2,
                        endLine: endLine2
                    });

                    newInstances.push(clone);
                }
            });
        });

        file.instances = file.instances.concat(newInstances);
        return file;
    }

    #expandCloneCandidates(file) {
        let expandedClones = [];

        for (let clone of file.instances) {
            let found = false;
            for (let accClone of expandedClones) {
                if (accClone.maybeExpandWith(clone)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                expandedClones.push(clone);
            }
        }

        file.instances = expandedClones;
        return file;
    }

    #consolidateClones(file) {
        file.instances = file.instances.reduce((accumulator, clone) => {
            let existingClone = accumulator.find(accClone => accClone.equals(clone));

            if (existingClone) {
                clone.targets.forEach(target => existingClone.addTarget(target));
            } else {
                accumulator.push(clone);
            }

            return accumulator;
        }, []);

        return file;
    }

    // Public Processing Steps
    // --------------------
    preprocess(file) {
        return new Promise((resolve, reject) => {
            if (!file.name.endsWith('.java')) {
                reject(file.name + ' is not a java file. Discarding.');
            } else if (this.#myFileStore.isFileProcessed(file.name)) {
                reject(file.name + ' has already been processed.');
            } else {
                resolve(file);
            }
        });
    }

    transform(file) {
        file = this.#filterLines(file);
        file = this.#chunkify(file);
        return file;
    }

    matchDetect(file) {
        let allFiles = this.#myFileStore.getAllFiles();
        file.instances = file.instances || [];
        for (let f of allFiles) {
            file = this.#filterCloneCandidates(file, f);
            file = this.#expandCloneCandidates(file);
            file = this.#consolidateClones(file);
        }

        return file;
    }

    pruneFile(file) {
        delete file.lines;
        delete file.instances;
        return file;
    }

    storeFile(file) {
        this.#myFileStore.storeFile(this.pruneFile(file));
        return file;
    }

    get numberOfProcessedFiles() { return this.#myFileStore.numberOfFiles; }
}

module.exports = CloneDetector;

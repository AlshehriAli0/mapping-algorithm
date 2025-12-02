/**
 * MinHeap - A priority queue where smallest element is always at the top
 * 
 * WHY WE USE IT:
 * - Dijkstra/A* need to always process the "closest" node next
 * - Without a heap: finding minimum takes O(n) every time = slow!
 * - With a heap: finding minimum takes O(1), insert/remove takes O(log n) = fast!
 * 
 * STRUCTURE: Binary tree stored as array
 *                    [0]          ← root (minimum)
 *                   /   \
 *                [1]     [2]      ← children of 0
 *               /  \    /  \
 *             [3] [4] [5] [6]     ← children of 1 and 2
 * 
 * RULE: Parent is always smaller than its children
 * 
 * Array index math:
 *   - Parent of node i:      Math.floor((i - 1) / 2)
 *   - Left child of node i:  2 * i + 1
 *   - Right child of node i: 2 * i + 2
 */
export class MinHeap {
    constructor() {
        this.heap = []; // stores [priority, ...data] arrays
    }

    // Add new item and restore heap property
    push(item) {
        this.heap.push(item);              // add to end
        this._bubbleUp(this.heap.length - 1); // float it up to correct position
    }

    // Remove and return the smallest item
    pop() {
        if (this.heap.length === 0) return null;
        
        const min = this.heap[0];          // save the minimum (root)
        const last = this.heap.pop();      // remove last element
        
        if (this.heap.length > 0) {
            this.heap[0] = last;           // move last to root
            this._bubbleDown(0);           // sink it down to correct position
        }
        return min;
    }

    size() {
        return this.heap.length;
    }

    // Float a node UP until heap property restored
    // Used after push: new item might be smaller than parent
    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            
            // Compare priorities (first element of array)
            // If parent is smaller or equal, we're done
            if (this.heap[index][0] >= this.heap[parentIndex][0]) break;
            
            // Swap with parent and continue up
            [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
            index = parentIndex;
        }
    }

    // Sink a node DOWN until heap property restored
    // Used after pop: element moved to root might be larger than children
    _bubbleDown(index) {
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            // Find smallest among current node and its children
            if (leftChild < this.heap.length && this.heap[leftChild][0] < this.heap[smallest][0]) {
                smallest = leftChild;
            }
            if (rightChild < this.heap.length && this.heap[rightChild][0] < this.heap[smallest][0]) {
                smallest = rightChild;
            }

            // If current node is smallest, heap property satisfied
            if (smallest === index) break;
            
            // Swap with smallest child and continue down
            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }
}

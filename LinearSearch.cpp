#include<iostream>
using namespace std;


int linearsearch(int arr[], int n, int element) {
	for (int i = 0; i < n;i++) {
		if (arr[i] == element) {
			return i;
		}
	}
	return -1;
}


int main() {
	int item, n;
	int arr[] = { 10,20,30,40,50,60 };
	n = sizeof(arr) / sizeof(arr[0]);
	cout << "Enter the item you want to search :  ";
	cin >> item;
	int R = linearsearch(arr,n,item);
	if (R == -1) {
		cout << "Not Found";
	}
	else {
		cout << "The the item {" <<  arr[R] << "} Is found at index: "<< R; ;
	}

	return 0;

}
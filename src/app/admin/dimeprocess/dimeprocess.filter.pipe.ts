import { Injectable, Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'dimeProcessFilter',
	pure: false
})
@Injectable( {	providedIn: 'root' } )
export class DimeProcessFilterPipe implements PipeTransform {
	transform(items: any, filter: any, isAnd: boolean): any {
		if (filter && Array.isArray(items)) {
			const filterKeys = Object.keys(filter);
			if (isAnd) {
				return items.filter(item =>
					filterKeys.reduce((memo, keyName) =>
						(memo && new RegExp(filter[keyName], 'gi').test(item[keyName])) || filter[keyName] === '', true));
			} else {
				return items.filter(item => {
					return filterKeys.some((keyName) => {
						return new RegExp(filter[keyName], 'gi').test(item[keyName]) || filter[keyName] === '';
					});
				});
			}
		} else {
			return items;
		}
	}
}
